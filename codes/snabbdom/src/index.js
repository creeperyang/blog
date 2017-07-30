import htmlDomApi from './domApi'
import vnode, { isVnode, isSameVnode } from './vnode'
import { isArray, isPrimitive } from './utils'

/**
 * 为 vnode 数组 begin～end 下标范围内的 vnode 创建它的 key 和 下标 的映射。
 * @param  {Array} children vnode 数组
 * @param  {Number} beginIdx 开始下标
 * @param  {Number} endIdx   结束下标
 * @return {Object}          key --> index 的 map
 */
function createKeyToOldIdx(children, beginIdx, endIdx) {
  let i, key, ch
  const map = {}
  // 遍历 vnode 数组，如果 vnode 有 key，记录这个 vnode 的下标
  for (i = beginIdx; i <= endIdx; ++i) {
    ch = children[i]
    if (ch != null) {
      key = ch.key
      if (key !== undefined) map[key] = i
    }
  }
  return map
}

/**
 * hook name | 所处阶段 | 参数
 * pre | the patch process begins | none
 * init | a vnode has been added | vnode
 * create | a DOM element has been created based on a vnode | emptyVnode, vnode
 * insert | an element has been inserted into the DOM | vnode
 * update | an element is being updated | oldVnode, vnode
 * destroy | an element is directly or indirectly being removed | vnode
 * remove | an element is directly being removed from the DOM | vnode, removeCallback
 * post | the patch process is done | none
 */
const hooks = ['pre', 'create', 'update', 'destroy', 'remove', 'post'];
const emptyNode = vnode('', '', {}, [], undefined, undefined);

export default function init(modules = [], domApi) {
  const api = domApi || htmlDomApi

  const cbs = {}
  let i, j
  // 从 modules 初始化 hooks
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      const hook = modules[j][hooks[i]]
      if (hook !== undefined) {
        cbs[hooks[i]].push(hook)
      }
    }
  }
  // 为实际 dom 创建 vnode
  function emptyNodeAt(elm) {
    return vnode(
      api.tagName(elm),
      undefined,
      {
        className: elm.className,
        id: elm.id
      },
      [],
      undefined,
      elm
    )
  }

  /**
   * 创建 remove 回调函数
   * @param  {Element} childElm  child element
   * @param  {Number} listeners listeners 数量
   * @return {Function}           remove 回调函数
   */
  function createRmCb(childElm, listeners) {
    return function rmCb() {
      // 在所有 listeners 被执行后才删除 dom
      if (--listeners === 0) {
        api.removeChild(
          api.parentNode(childElm),
          childElm
        )
      }
    }
  }

  // 为 vnode（tree） 实际创建 dom（未插入文档）
  function createElm(vnode, insertedVnodeQueue) {
    let data = vnode.data
    let i
    if (data) {
      // 调用 init hook
      if (data.hook && (i = data.hook.init)) {
        i(vnode)
        // data 可能在 init hook 中被改变，重新获取。
        data = vnode.data
      }
    } else {
      data = {}
    }

    let children = vnode.children
    let type = vnode.type

    // 处理 comment
    if (type === 'comment') {
      if (vnode.text == null) {
        vnode.text = ''
      }
      vnode.elm = api.createComment(vnode.text)
    }
    // 处理其它 type
    else if (type) {
      const elm = vnode.elm = data.ns
        ? api.createElementNS(data.ns, type)
        : api.createElement(type)

      // 调用 create hook
      for (let i = 0; i < cbs.create.length; ++i) cbs.create[i](emptyNode, vnode)

      // 分别处理 children 和 text。
      // 这里隐含一个逻辑：vnode 的 children 和 text 不会／应该同时存在。
      if (isArray(children)) {
        // 递归 children，保证 vnode tree 中每个 vnode 都有自己对应的 dom；
        // 即构建 vnode tree 对应的 dom tree。
        children.forEach(ch => {
          ch && api.appendChild(elm, createElm(ch, insertedVnodeQueue))
        })
      }
      else if (isPrimitive(vnode.text)) {
        api.appendChild(elm, api.createTextNode(vnode.text))
      }
      // 调用 create hook；为 insert hook 填充 insertedVnodeQueue。
      i = vnode.data.hook
      if (i) {
        i.create && i.create(emptyNode, vnode)
        i.insert && insertedVnodeQueue.push(vnode)
      }
    }
    // 处理 text
    else {
      vnode.elm = api.createTextNode(vnode.text)
    }

    return vnode.elm
  }

  /**
   * 对 vnode 及其 children 递归执行 destroy hook
   * @param  {Object} vnode vnode
   * @return {Undefined}
   */
  function invokeDestroyHook(vnode) {
    let i, j
    if (vnode.data) {
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
      if (vnode.children) {
        for (j = 0; j < vnode.children.length; ++j) {
          i = vnode.children[j]
          if (i && typeof i !== 'string') {
            invokeDestroyHook(i)
          }
        }
      }
    }
  }

  /**
   * 从 parent dom 删除 vnode 数组对应的 dom
   * @param {Element} parentElm          父dom
   * @param {Array} vnodes             vnode 数组
   * @param {Number} startIdx           vnodes 的 start index
   * @param {Number} endIdx             vnodes 的 end index
   */
  function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      let ch = vnodes[startIdx]
      let listeners
      let rm
      let i
      if (ch != null) {
        if (ch.type) {
          // 调用 destroy hook
          invokeDestroyHook(ch)
          listeners = cbs.remove.length + 1
          rm = createRmCb(ch.elm, listeners)
          // 每个 remove 回调执行时 listeners 减 1，所有回调执行完后，才真的删除 dom。
          for (i = 0; i < cbs.remove.length; ++i) cbs.remove[i](ch, rm)
          if ((i = ch.data) && (i = i.hook) && (i = i.remove)) {
            i(ch, rm)
          } else {
            rm()
          }
        } else {
          api.removeChild(parentElm, ch.elm)
        }
      }
    }
  }

  /**
   * 添加 vnode 数组对应的 dom 到 parent dom
   * @param {Element} parentElm          父dom
   * @param {Element} before             添加时指定的 before dom
   * @param {Array} vnodes             vnode 数组
   * @param {Number} startIdx           vnodes 的 start index
   * @param {Number} endIdx             vnodes 的 end index
   * @param {Array} insertedVnodeQueue createElm所用
   */
  function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx]
      if (ch != null) {
        api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before)
      }
    }
  }

  /**
   * 比较新旧 children 并更新
   * @param  {Element} parentElm          父 dom，children 对应的 dom 将要挂载的
   * @param  {Array} oldCh              旧 children，vnode 数组
   * @param  {Array} newCh              新 children，vnode 数组
   * @param  {Array} insertedVnodeQueue 用于存储将要插入的 dom 节点
   * @return {Undefined}
   */
  function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
    let oldStartIdx = 0, newStartIdx = 0
    let oldEndIdx = oldCh.length - 1
    let oldStartVnode = oldCh[0]
    let oldEndVnode = oldCh[oldEndIdx]
    let newEndIdx = newCh.length - 1
    let newStartVnode = newCh[0]
    let newEndVnode = newCh[newEndIdx]
    let oldKeyToIdx
    let idxInOld
    let elmToMove
    let before

    // 遍历 oldCh 和 newCh 来比较和更新
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      // 1⃣️ 首先检查 4 种情况，保证 oldStart/oldEnd/newStart/newEnd
      // 这 4 个 vnode 非空，左侧的 vnode 为空就右移下标，右侧的 vnode 为空就左移 下标。
      if (oldStartVnode == null) {
        oldStartVnode = oldCh[++oldStartIdx]
      } else if (oldEndVnode == null) {
        oldEndVnode = oldCh[--oldEndIdx]
      } else if (newStartVnode == null) {
        newStartVnode = newCh[++newStartIdx]
      } else if (newEndVnode == null) {
        newEndVnode = newCh[--newEndIdx]
      }
      /**
       * 2⃣️ 然后 oldStartVnode/oldEndVnode/newStartVnode/newEndVnode 两两比较，
       * 对有相同 vnode 的 4 种情况执行对应的 patch 逻辑。
       * - 如果同 start 或同 end 的两个 vnode 是相同的（情况 1 和 2），
       *   说明不用移动实际 dom，直接更新 dom 属性／children 即可；
       * - 如果 start 和 end 两个 vnode 相同（情况 3 和 4），
       *   那说明发生了 vnode 的移动，同理我们也要移动 dom。
       */
      // 1. 如果 oldStartVnode 和 newStartVnode 相同（key相同），执行 patch
      else if (isSameVnode(oldStartVnode, newStartVnode)) {
        // 不需要移动 dom
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue)
        oldStartVnode = oldCh[++oldStartIdx]
        newStartVnode = newCh[++newStartIdx]
      }
      // 2. 如果 oldEndVnode 和 newEndVnode 相同，执行 patch
      else if (isSameVnode(oldEndVnode, newEndVnode)) {
        // 不需要移动 dom
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue)
        oldEndVnode = oldCh[--oldEndIdx]
        newEndVnode = newCh[--newEndIdx]
      }
      // 3. 如果 oldStartVnode 和 newEndVnode 相同，执行 patch
      else if (isSameVnode(oldStartVnode, newEndVnode)) {
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue)
        // 把获得更新后的 (oldStartVnode/newEndVnode) 的 dom 右移，移动到
        // oldEndVnode 对应的 dom 的右边。为什么这么右移？
        // （1）oldStartVnode 和 newEndVnode 相同，显然是 vnode 右移了。
        // （2）若 while 循环刚开始，那移到 oldEndVnode.elm 右边就是最右边，是合理的；
        // （3）若循环不是刚开始，因为比较过程是两头向中间，那么两头的 dom 的位置已经是
        //     合理的了，移动到 oldEndVnode.elm 右边是正确的位置；
        // （4）记住，oldVnode 和 vnode 是相同的才 patch，且 oldVnode 自己对应的 dom
        //     总是已经存在的，vnode 的 dom 是不存在的，直接复用 oldVnode 对应的 dom。
        api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm))
        oldStartVnode = oldCh[++oldStartIdx]
        newEndVnode = newCh[--newEndIdx]
      }
      // 4. 如果 oldEndVnode 和 newStartVnode 相同，执行 patch
      else if (isSameVnode(oldEndVnode, newStartVnode)) {
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue)
        // 这里是左移更新后的 dom，原因参考上面的右移。
        api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
        oldEndVnode = oldCh[--oldEndIdx]
        newStartVnode = newCh[++newStartIdx]
      }

      // 3⃣️ 最后一种情况：4 个 vnode 都不相同，那么我们就要
      // 1. 从 oldCh 数组建立 key --> index 的 map。
      // 2. 只处理 newStartVnode （简化逻辑，有循环我们最终还是会处理到所有 vnode），
      //    以它的 key 从上面的 map 里拿到 index；
      // 3. 如果 index 存在，那么说明有对应的 old vnode，patch 就好了；
      // 4. 如果 index 不存在，那么说明 newStartVnode 是全新的 vnode，直接
      //    创建对应的 dom 并插入。
      else {
        // 如果 oldKeyToIdx 不存在，创建 old children 中 vnode 的 key 到 index 的
        // 映射，方便我们之后通过 key 去拿下标。
        if (oldKeyToIdx === undefined) {
          oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)
        }
        // 尝试通过 newStartVnode 的 key 去拿下标
        idxInOld = oldKeyToIdx[newStartVnode.key]
        // 下标不存在，说明 newStartVnode 是全新的 vnode。
        if (idxInOld == null) {
          // 那么为 newStartVnode 创建 dom 并插入到 oldStartVnode.elm 的前面。
          api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm)
          newStartVnode = newCh[++newStartIdx]
        }
        // 下标存在，说明 old children 中有相同 key 的 vnode，
        else {
          elmToMove = oldCh[idxInOld]
          // 如果 type 不同，没办法，只能创建新 dom；
          if (elmToMove.type !== newStartVnode.type) {
            api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm)
          }
          // type 相同（且key相同），那么说明是相同的 vnode，执行 patch。
          else {
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue)
            oldCh[idxInOld] = undefined
            api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm)
          }
          newStartVnode = newCh[++newStartIdx]
        }
      }
    }

    // 上面的循环结束后（循环条件有两个），处理可能的未处理到的 vnode。
    // 如果是 new vnodes 里有未处理的（oldStartIdx > oldEndIdx
    // 说明 old vnodes 先处理完毕）
    if (oldStartIdx > oldEndIdx) {
      before = newCh[newEndIdx+1] == null ? null : newCh[newEndIdx+1].elm
      addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)
    }
    // 相反，如果 old vnodes 有未处理的，删除 （为处理 vnodes 对应的） 多余的 dom。
    else if (newStartIdx > newEndIdx) {
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
    }
  }

  /**
   * patch oldVnode 和 vnode （它们是相同的 vnode）
   * 1. 更新本身对应 dom 的 textContent/children/其它属性；
   * 2. 根据 children 的变化去决定是否递归 patch children 里的每个 vnode。
   * @param  {Object} oldVnode           旧 vnode
   * @param  {Object} vnode              新 vnode
   * @param  {Array} insertedVnodeQueue  记录新插入的 vnode
   * @return {Undefined}
   */
  function patchVnode(oldVnode, vnode, insertedVnodeQueue) {
    // 因为 vnode 和 oldVnode 是相同的 vnode，所以我们可以复用 oldVnode.elm。
    const elm = vnode.elm = oldVnode.elm
    let oldCh = oldVnode.children
    let ch = vnode.children

    // 如果 oldVnode 和 vnode 是同一个，说明无需更新，直接返回。
    if (oldVnode === vnode) return

    // 调用 update hook
    if (vnode.data) {
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
    }

    // 如果 vnode.text 是 undefined
    if (vnode.text === undefined) {
      // 比较 old children 和 new children，并更新
      if (oldCh && ch) {
        if (oldCh !== ch) {
          // 核心逻辑（最复杂的地方）：怎么比较新旧 children 并更新
          updateChildren(elm, oldCh, ch, insertedVnodeQueue)
        }
      }
      // 添加新 children
      else if (ch) {
        // 首先删除原来的 text
        if (oldVnode.text) api.setTextContent(elm, '')
        // 然后添加新 dom（对 ch 中每个 vnode 递归创建 dom 并插入到 elm）
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
      }
      // 相反地，如果原来有 children 而现在没有，那么我们要删除 children。
      else if (oldCh) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1);
      }
      // 最后，如果 oldVnode 有 text，删除。
      else if (oldVnode.text) {
        api.setTextContent(elm, '');
      }
    }
    // 否则 （vnode 有 text），只要 text 不等，更新 dom 的 text。
    else if (oldVnode.text !== vnode.text) {
      api.setTextContent(elm, vnode.text)
    }
  }

  return function patch(oldVnode, vnode) {
    let elm, parent
    const insertedVnodeQueue = []
    let i
    // 调用 pre hook
    for (i = 0; i < cbs.pre.length; ++i) cbs.pre[i]()

    // 如果 oldVnode 不是 vnode（即是 dom），创建 vnode
    if (!isVnode(oldVnode)) {
      oldVnode = emptyNodeAt(oldVnode)
    }

    // 如果 oldVnode 和 vnode 是相同的 vnode，执行 patch。
    if (isSameVnode(oldVnode, vnode)) {
      patchVnode(oldVnode, vnode, insertedVnodeQueue)
    }
    // 否则，直接把 oldVnode 替换为 vnode。
    else {
      elm = oldVnode.elm
      parent = api.parentNode(elm)

      createElm(vnode, insertedVnodeQueue)

      // 如果原 vnode 有 parent，那么插入新 vnode 对应的 dom，删除原 dom。
      if (parent !== null) {
        api.insertBefore(parent, vnode.elm, api.nextSibling(elm))
        removeVnodes(parent, [oldVnode], 0, 0)
      }
    }

    // 调用 insert hook。
    for (i = 0; i < insertedVnodeQueue.length; ++i) {
      // 为什么不用判断 insert 是否存在？
      // 因为填充 insertedVnodeQueue 时已判断。
      insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i])
    }
    // 调用 post hook。
    for (i = 0; i < cbs.post.length; ++i) cbs.post[i]()
    return vnode
  }
}
