# snabbdom 源码解析

snabbdom 的 ES6 版本（有细微不同点），核心代码有详细注释，主要用于理解 snabbdom 。

代码结构：

```bash
src
├── domApi.js    # dom api，主要是各种 DOM 操作的包装，快速浏览即可。
├── export.js    # export，决定暴露什么接口给调用者，可忽略。
├── h.js         # `h()`帮助函数，很简单。
├── index.js     # 核心代码，Virtual DOM 的 diff 实现，从 Virtual DOM 构建 DOM 等等。
├── modules      # 各个模块，主要负责属性处理。
│   ├── class.js
│   ├── props.js
│   └── style.js
├── utils.js     # util 函数。
└── vnode.js     # vnode 定义和一些相关函数。
```

看 snabbdom 的实际例子：

```bash
npm i && npm run start
```