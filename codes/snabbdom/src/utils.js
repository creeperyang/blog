/**
 * 一些工具函数
 */

export const isArray = Array.isArray

export const isPrimitive = val => {
  const type = typeof val
  return type === 'number' || type === 'string'
}

export const flattenArray = array => {
  return Array.prototype.concat.apply([], array)
}
