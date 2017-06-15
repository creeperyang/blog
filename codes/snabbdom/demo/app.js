const patch = snabbdom.patch
const h = snabbdom.h

const container = document.getElementById('container')

const vnode = h('div', {id: 'container'}, [
  h('span', {style: {fontWeight: 'bold'}}, 'This is bold'),
  ' and this is just normal text',
  h('a', {
    props: {href: '/foo'}
  }, 'I\'ll take you places!')
])

console.log(vnode)
patch(container, vnode)

const newVnode = h('div', {id: 'container'}, [
  h('span', {style: {fontWeight: 'normal', fontStyle: 'italic'}}, 'This is now italic type'),
  ' and this is still just normal text',
  h('a', {
    props: {href: '/bar'}
  }, 'I\'ll take you places!')
])
setTimeout(() => {
  patch(vnode, newVnode)
}, 7000)


const footer = document.getElementById('footer')

function getList(count) {
  return h(
    'ul',
    {
      id: 'footer',
      className: 'hello hi',
      style: {
        color: '#666'
      }
    },
    Array.apply(null, {length: count})
      .map((v, i) => i + 1)
      .map(n => h(
        'li',
        {
          className: 'item',
          key: n
        },
        `number is ${n}`
      ))
  )
}
const sVnode = getList(3)
patch(footer, sVnode)

setTimeout(() => {
  patch(sVnode, getList(10))
}, 4000)
