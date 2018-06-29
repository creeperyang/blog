const { observe } = require('./dist/core/observer')
const Watcher = require('./dist/core/observer/watcher').default

function createWatcher(data, expOrFn, cb, options) {
  const vm = {
    data: data || {},
    _watchers: []
  }
  observe(vm.data, true)
  return new Watcher(vm, expOrFn, cb, options)
}

const raw = {
  s: 'hi',
  n: 100,
  o: {x: 1, arr: [1, 2]},
  arr: [8, 9]
}

const w = createWatcher(raw, function expOrFn() {
  return this.data.o + this.data.arr.length
}, (now, prev) => {
  console.log('--->', now, prev)
}, {
  deep: false,
  sync: true
})

// raw.o = 'hello'
raw.o.x = 2
// raw.arr.push(10)
