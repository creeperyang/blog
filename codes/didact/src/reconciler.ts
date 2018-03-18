import { Component, createInstance } from './component';
import { createDomElement, updateDomProperties } from './dom-utils';
import { Effect, IdleDeadline, IdleRequestCallback, IFiber, ITag, IUpdate, IVNode } from './interface';

declare var requestIdleCallback: (fn: IdleRequestCallback) => number;

// 毫秒，检测 deadline.timeRemaining() 是否有足够空余时间。
const ENOUGH_TIME = 1;

// 追踪/缓存 pending updates，空闲时执行这些更新
const updateQueue: IUpdate[] = [];
let nextUnitOfWork: IFiber | null | undefined = null;
let pendingCommit: IFiber | null = null;

/**
 * 把 virtual DOM tree（可以是数组）渲染到对应的容器 DOM
 * @param elements VNode elements to render
 * @param containerDom container dom element
 */
export function render(elements: any, containerDom: HTMLElement) {
    // 把 update 压入 updateQueue
    updateQueue.push({
        from: ITag.HOST_ROOT,
        dom: containerDom,
        newProps: { children: elements },
    });
    requestIdleCallback(performWork);
}

/**
 * 安排更新，通常是由 setState 调用。
 * @param instance 组件实例
 * @param partialState state，通常是对象
 */
export function scheduleUpdate(instance: Component, partialState: any) {
    // 把 update 压入 updateQueue
    updateQueue.push({
        // scheduleUpdate 只被 setState 调用，所以来源一定是 CLASS_COMPONENT
        from: ITag.CLASS_COMPONENT,
        // 相应组件实例
        instance,
        // setState 传来的参数
        partialState,
    });
    // 下次空闲时开始更新
    requestIdleCallback(performWork);
}

/**
 * 执行渲染/更新工作
 * @param {IdleDeadline} deadline requestIdleCallback 传来，用于检测空闲时间
 */
function performWork(deadline: IdleDeadline) {
    workLoop(deadline);
    if (nextUnitOfWork || updateQueue.length > 0) {
        requestIdleCallback(performWork);
    }
}

/**
 * 核心功能，把更新工作分片处理（可打断）；处理结束后进入提交阶段（不可打断）。
 *
 * 1. 通过 deadline 去查看剩余可执行时间，时间不够时暂停处理；
 * 2. 把 wip fiber tree 的创建工作分片处理（可分片/暂停，因为没有操作DOM）；
 * 3. 一旦 wip fiber tree 创建完毕，同步执行 DOM 更新。
 * @param {IdleDeadline} deadline requestIdleCallback() 的参数
 */
function workLoop(deadline: IdleDeadline) {
    // 如果 nextUnitOfWork 为空，则重新开始分片工作。
    if (!nextUnitOfWork) {
        resetNextUnitOfWork();
    }
    // 如果 nextUnitOfWork 非空，且剩余空闲时间足够，继续 reconcile
    // 实质上是在构造新的 work-in-progress fiber tree
    while (nextUnitOfWork && deadline.timeRemaining() > ENOUGH_TIME) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    }
    if (pendingCommit) {
        commitAllWork(pendingCommit);
    }
}

/**
 * 重新开始分片工作 （next unit of work），设置reconciler的起点。
 */
function resetNextUnitOfWork() {
    // 从 updateQueue 从取出最早的 update，如果没有，说明无更新要做，结束。
    const update = updateQueue.shift();
    if (!update) {
        return;
    }

    // 如果有 partialState （说明一定是 setState，一定是 Class Componnet）
    // 则把 partialState 存到对应的（old）fiber 上。
    if (update.partialState) {
        ((update.instance as Component).__fiber as IFiber).partialState = update.partialState;
    }

    // 获取 root fiber
    // 1. 如果是 Tag.HOST_ROOT，说明是 React.render() ，直接拿 update.dom._rootContainerFiber；
    // 2. 否则是 Class Componnet，从 update.instance.__fiber 一路往上拿到 root fiber。
    const root =
        update.from === ITag.HOST_ROOT
            ? (update.dom as any)._rootContainerFiber
            : getRoot((update.instance as Component).__fiber as IFiber);

    // nextUnitOfWork （reconciler的起点）被设置为一个 fiber，
    // 这个 fiber 是一个全新的 work-in-progress fiber tree 的 root
    nextUnitOfWork = {
        tag: ITag.HOST_ROOT, // 标记为 root
        // 1. 如果之前没有 old tree（即是 React.render），则设为传来的参数 DOM；
        // 2. 否则复用之前的 root.stateNode。
        stateNode: update.dom || root.stateNode,
        // 1. 如果之前没有 old tree（即是 React.render），则props 是 newProps；
        // 2. 否则共享原来的 props。
        // 如果使用 newProps，我们知道，children 是什么将无法保证。
        props: update.newProps || root.props,
        // 对应的 old fiber tree（React.render 时为 null）
        alternate: root,
    };
}

/**
 * 对当前 fiber 取 root （通过 fiber 的 parent 属性）
 * @param {IFiber} fiber fiber 对象
 */
function getRoot(fiber: IFiber): IFiber {
    let node = fiber;
    while (node.parent) {
        node = node.parent;
    }
    return node;
}

/**
 * 迭代创建 work-in-progress fiber
 * @param wipFiber work-in-progress fiber
 */
function performUnitOfWork(wipFiber: IFiber) {
    // 为 wipFiber 创建 children fibers
    beginWork(wipFiber);
    // 如果有 children fibers，返回第一个 child 作为 nextUnitOfWork
    if (wipFiber.child) {
        return wipFiber.child;
    }

    // 没有 child，我们调用 completeWork 直到我们找到一个 sibling 作为 nextUnitOfWork。
    // 如果没有 sibling 的话，向上找 parent。
    let uow: IFiber | null | undefined = wipFiber;
    while (uow) {
        completeWork(uow);
        // 如果有 sibling，设置 sibling 作为 nextUnitOfWork，重新开始。
        if (uow.sibling) {
            // Sibling needs to beginWork
            return uow.sibling;
        }
        // 否则，向上找到 parent （children已处理完毕）开始 completeWork。
        uow = uow.parent;
    }
}

/**
 * 为 fiber 创建 children fibers
 *
 * 1. 创建 stateNode 如果 wipFiber 没有的话；
 * 2. 对 wipFiber 的 children 执行 reconcileChildrenArray。
 * @param {IFiber} wipFiber 当前 work-in-progress fiber
 */
function beginWork(wipFiber: IFiber) {
    if (wipFiber.tag === ITag.CLASS_COMPONENT) {
        updateClassComponent(wipFiber);
    } else {
        updateHostComponent(wipFiber);
    }
}

/**
 * 处理 host component 和 root component（即都 host/原生 组件）。
 * @param wipFiber 当前 work-in-progress fiber
 */
function updateHostComponent(wipFiber: IFiber) {
    // 如果没有 stateNode (比如 React.render)，创建 stateNode。
    // ⚠️不会为 child 创建 DOM，也不会把 DOM 添加到 document。
    if (!wipFiber.stateNode) {
        wipFiber.stateNode = createDomElement(wipFiber) as Element;
    }

    // 从 wipFiber 的 props.children 获取 children 来创建 children fibers。
    const newChildElements = wipFiber.props.children;
    reconcileChildrenArray(wipFiber, newChildElements);
}

/**
 * 处理 class component（即用户自定义的组件）。
 * @param wipFiber 当前 work-in-progress fiber
 */
function updateClassComponent(wipFiber: IFiber) {
    let instance = wipFiber.stateNode as Component;
    // 如果 instance 不存在，调用 constructor 来创建实例。
    if (instance == null) {
        instance = wipFiber.stateNode = createInstance(wipFiber);
    }
    // 否则，如果 props 没变，且不存在更新了 state，则不需要做更新。
    // 复制上次的 children 即可。
    else if (wipFiber.props === instance.props && !wipFiber.partialState) {
        cloneChildFibers(wipFiber);
        return;
    }

    // 更新 props，state，用于调用 render，获取虚拟 vnode tree。
    instance.props = wipFiber.props;
    instance.state = Object.assign({}, instance.state, wipFiber.partialState);
    wipFiber.partialState = null;

    // 同样，我们得到了 child elements 来创建 children fibers；
    // ⚠️由于 reconcileChildrenArray 支持数组，所以现在 render 可以返回数组了！
    const newChildElements = instance.render();
    reconcileChildrenArray(wipFiber, newChildElements);
}

function arrify(val: any) {
    return val == null ? [] : Array.isArray(val) ? val : [val];
}

/**
 * 核心函数，逐步创建 work-in-progress tree，决定提交阶段 （commit phase）需要
 * 做的 DOM 操作（怎么更新 DOM）。
 * 这里主要是比较 alternate 的 children filbers 和 newChildElements （virtual nodes）。
 * @param wipFiber work-in-progress fiber
 * @param newChildElements 要处理的 virtual dom tree(s)，用于创建 children fibers。
 */
function reconcileChildrenArray(wipFiber: IFiber, newChildElements: any) {
    // newChildElements 无法保证是数组，可能是单个 element，也可能是 null。
    const elements = arrify(newChildElements) as IVNode[];

    let index = 0;
    let oldFiber = wipFiber.alternate ? wipFiber.alternate.child : null;
    let newFiber: IFiber | null = null;
    while (index < elements.length || oldFiber != null) {
        // 记录 prevFiber （开始时是 null），用于后面更新 sibling 属性
        const prevFiber = newFiber;
        const element = index < elements.length && elements[index];
        const sameType = oldFiber && element && element.type === oldFiber.type;

        // 如果是相同类型（肯定已满足：element 和 oldFiber 都存在）
        // 说明只需要执行更新就好
        if (sameType) {
            newFiber = {
                // 和 oldFiber 共享相同的 type/tag/stateNode
                type: (oldFiber as IFiber).type,
                tag: (oldFiber as IFiber).tag,
                stateNode: (oldFiber as IFiber).stateNode,
                // 设置 parent 和 alternate
                parent: wipFiber,
                alternate: oldFiber,
                // 设置 props 和 partialState
                props: (element as IVNode).props,
                partialState: (oldFiber as IFiber).partialState,
                // 设置为 UPDATE
                effectTag: Effect.UPDATE,
            };
        }
        // 如果类型不同（可能是添加/删除/替换）
        else {
            // 如果 element 存在，则需要添加/替换为 element 代表的新 DOM
            if (element) {
                newFiber = {
                    // 设置 type 和 tag，stateNode 为空，稍后处理
                    type: element.type,
                    tag: typeof element.type === 'string'
                        ? ITag.HOST_COMPONENT
                        : ITag.CLASS_COMPONENT,
                    props: element.props,
                    parent: wipFiber,
                    // 设置为 PLACEMENT
                    effectTag: Effect.PLACEMENT,
                };
            }
            // 如果有 oldFiber，则要删除 oldFiber 对应的 DOM，这里通过 parent fiber 记录删除操作
            // ⚠️ 本质是因为 oldFiber 不在 wip fiber tree 内了，在 completeWork 时无法被
            // 遍历到，只能先放到 parent fiber 的 effects 中。
            if (oldFiber) {
                oldFiber.effectTag = Effect.DELETION;
                wipFiber.effects = wipFiber.effects || [];
                wipFiber.effects.push(oldFiber);
            }
        }

        // 更新 oldFiber 为 oldFiber 的 sibling，继续处理过程
        if (oldFiber) {
            oldFiber = oldFiber.sibling;
        }

        // 如果 index 为 0，说明是处理的第一个 child fiber，则
        // 需要设置父 fiber 的 child 属性
        if (index === 0) {
            wipFiber.child = newFiber;
        }
        // 否则如果 elelment 存在，更新 prevFiber 的 sibling 属性
        // 通过这两步操作，建立 wip fiber tree。
        else if (prevFiber && element) {
            prevFiber.sibling = newFiber;
        }

        // 继续处理下一个 element
        index++;
        // 可以看到，reconciliation 过程中没有使用 key，所以不知道来 child 是否有被移动位置过。
    }
}

/**
 * 直接复制对应 old fiber 的 children fibers 到 work-in-progress fiber
 * 由于我们确信没有更新，所以只需要复制就好。
 * @param parentFiber work-in-progress fiber
 */
function cloneChildFibers(parentFiber: IFiber) {
    const oldFiber = parentFiber.alternate as IFiber;
    if (!oldFiber.child) {
        return;
    }

    let oldChild: IFiber | null | undefined = oldFiber.child;
    let prevChild: IFiber | null = null;
    // 通过 sibling 属性递归复制所有children fibers
    while (oldChild) {
        // 确保不共享 fiber，直接复制 old fiber的每个属性。
        const newChild = {
            type: oldChild.type,
            tag: oldChild.tag,
            stateNode: oldChild.stateNode,
            props: oldChild.props,
            partialState: oldChild.partialState,
            alternate: oldChild,
            parent: parentFiber,
        };
        if (prevChild) {
            prevChild.sibling = newChild;
        } else {
            parentFiber.child = newChild;
        }
        prevChild = newChild;
        oldChild = oldChild.sibling;
    }
}

/**
 * 设置 CLASS_COMPONENT fiber 的 __fiber，为 parent fiber 建立 effects。
 * @param fiber 叶子fiber（没有children）或者子fiber已执行过 completework 的fiber
 */
function completeWork(fiber: IFiber) {
    // 此时 fiber 是叶子fiber（没有children）或者子fiber已执行过 completework 的fiber。

    // 如果 fiber 对应的组件是 CLASS_COMPONENT，设置 __fiber，用于之后
    // resetNextUnitOfWork 时找到 root fiber。
    if (fiber.tag === ITag.CLASS_COMPONENT) {
        (fiber.stateNode as Component).__fiber = fiber;
    }

    // 如果 fiber 有 parent，则把 fiber 自身的 effects （以及子 fiber 的 effects）
    // 合并到 parent 的 effects。
    // 这其实是在 root fiber 的 effects 中收集了所有 fiber （该 fiber 有 effectTag）。
    if (fiber.parent) {
        const childEffects = fiber.effects || [];
        const thisEffect = fiber.effectTag != null ? [fiber] : [];
        const parentEffects = fiber.parent.effects || [];
        fiber.parent.effects = parentEffects.concat(childEffects, thisEffect);
    }
    // 没有 parent，说明已经处理到 root fiber，处理结束，开始 commit 阶段。
    // 把 pendingCommit 设为 root fiber。
    else {
        pendingCommit = fiber;
    }
}

/**
 * 遍历root fiber的 effects （通过 completeWork 已收集所有变更），执行更新。
 * @param fiber root fiber
 */
function commitAllWork(fiber: IFiber) {
    (fiber.effects as IFiber[]).forEach((f) => {
        commitWork(f);
    });
    // 在container DOM 上设置 _rootContainerFiber，
    // 用于之后resetNextUnitOfWork 时找到 root fiber。
    (fiber.stateNode as any)._rootContainerFiber = fiber;
    // 重置 nextUnitOfWork 和 pendingCommit，等待下一次更新触发（setState/render）。
    nextUnitOfWork = null;
    pendingCommit = null;
}

/**
 * 检查 fiber 的 effectTag 并做对应的更新。
 * @param fiber 需要处理的 fiber
 */
function commitWork(fiber: IFiber) {
    // HOST_ROOT 无需处理
    if (fiber.tag === ITag.HOST_ROOT) {
        return;
    }

    let domParentFiber: IFiber = fiber.parent as IFiber;
    // 对于 CLASS_COMPONENT 套 CLASS_COMPONENT 的情况，向上找到非 CLASS_COMPONENT
    // 的 fiber，从而取到对应的真正的 DOM
    while (domParentFiber.tag === ITag.CLASS_COMPONENT) {
        domParentFiber = domParentFiber.parent as IFiber;
    }
    const domParent = domParentFiber.stateNode as Element;

    // 如果是 PLACEMENT 且 fiber 对应 HOST_COMPONENT，添加 stateNode 到 domParent
    if (fiber.effectTag === Effect.PLACEMENT && fiber.tag === ITag.HOST_COMPONENT) {
        domParent.appendChild(fiber.stateNode as Element);
    }
    // 如果是 UPDATE，更新属性即可。
    else if (fiber.effectTag === Effect.UPDATE) {
        updateDomProperties(fiber.stateNode as HTMLElement, (fiber.alternate as IFiber).props, fiber.props);
    }
    // 如果是 DELETION，删除即可。
    else if (fiber.effectTag === Effect.DELETION) {
        commitDeletion(fiber, domParent);
    }
}

/**
 * 删除 fiber 对应的 DOM。
 * @param fiber 要执行删除的目标 fiber
 * @param domParent fiber 所包含的 DOM 的 parent DOM
 */
function commitDeletion(fiber: IFiber, domParent: Element) {
    let node = fiber;
    while (true) {
        // 如果 node 是 CLASS_COMPONENT，则取其 child
        if (node.tag === ITag.CLASS_COMPONENT) {
            node = node.child as IFiber;
            continue;
        }
        // BEGIN: 删除 node 对应的 DOM元素（stateNode）
        domParent.removeChild(node.stateNode as Element);

        /// 在 BEGIN 和 END 之间：

        // node 不是 fiber 且 node 没有 sibling，则向上取 parent。
        // 为什么有这种操作？可以看到前面在 node 是 CLASS_COMPONENT 时，我们向下取 child 了。
        // 当我们删除了 child 之后，我们需要向上返回，并删除 node 的 sibling。
        // 这种向上返回的过程结束于 2 种情况：
        // 1. node 有 sibling，则我们要 break 下来删除这个 sibling（后面从这个 sibling 向上返回）；
        // 2. node 已经是 fiber，此时整个删除过程已经结束。
        while (node !== fiber && !node.sibling) {
            node = node.parent as IFiber;
        }
        // 如果 node 是 fiber，结束删除过程。
        // ⚠️（删除 fiber 的 sibling显然是错误的，我们要删除的是 fiber 对应的 DOM）
        if (node === fiber) {
            return;
        }

        // END: 取 node 的 sibling，并继续删除。
        node = node.sibling as IFiber;
    }
}
