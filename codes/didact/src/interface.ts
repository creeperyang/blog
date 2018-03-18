import { Component } from './component';

// Fiber 标签
export enum ITag {
    HOST_COMPONENT = 'host',
    CLASS_COMPONENT = 'class',
    HOST_ROOT = 'root',
}

// Effect 标签
export enum Effect {
    PLACEMENT = 1,
    DELETION = 2,
    UPDATE = 3,
}

export interface IdleDeadline {
    didTimeout: boolean;
    timeRemaining(): number;
}

export type IdleRequestCallback = (deadline: IdleDeadline) => any;

export type ComponentType = string | (() => object);

export interface IState {
    [key: string]: any;
}

export interface IVNode {
    type: ComponentType;
    props: {
        children?: IVNode[],
        [key: string]: any,
    };
}

export interface IProps {
    children?: IVNode[];
    style?: object;
    [key: string]: any;
}

export interface IFiber {
    tag: ITag;
    type?: ComponentType;

    // parent/child/sibling 用于构建 fiber tree，对应相应的组件树。
    parent?: IFiber | null;
    child?: IFiber | null;
    sibling?: IFiber | null;

    // 大多数时候，我们有2棵fiber树：
    // 1. 一棵对应已经渲染到DOM的，我们称之为 current tree / old tree；
    // 2. 一棵是我们正在创建的，对应新的更新（setState() 或者 React.render()），叫 work-in-progress tree。
    // ⚠️ work-in-progress tree 不和 old tree 共享任何 fiber；一旦 work-in-progress tree 创建
    //    完成并完成需要的 DOM 更新，work-in-progress tree 即变成 old tree 。
    // alternate 用于 work-in-progress fiber 链接/指向（link）到它们对应的 old tree 上的 fiber。
    // fiber 和它的 alternate 共享 tag, type 和 stateNode。
    alternate?: IFiber | null;

    // 指向组件实例的引用，可以是 DOM element 或者 Class Component 的实例
    stateNode?: Element | Component;

    props: IProps;
    partialState?: IState | null;
    effectTag?: Effect;
    effects?: IFiber[];
}

export interface IUpdate {
    from: ITag;
    dom?: HTMLElement;
    instance?: Component;
    newProps?: IProps;
    partialState?: IState | null;
}
