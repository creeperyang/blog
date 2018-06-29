/*       */

import { escape } from '../util'
import { hyphenate } from 'shared/util'
import { getStyle } from 'web/util/style'

export function genStyle (style        )         {
  let styleText = ''
  for (const key in style) {
    const value = style[key]
    const hyphenatedKey = hyphenate(key)
    if (Array.isArray(value)) {
      for (let i = 0, len = value.length; i < len; i++) {
        styleText += `${hyphenatedKey}:${value[i]};`
      }
    } else {
      styleText += `${hyphenatedKey}:${value};`
    }
  }
  return styleText
}

export default function renderStyle (vnode               )          {
  const styleText = genStyle(getStyle(vnode, false))
  if (styleText !== '') {
    return ` style=${JSON.stringify(escape(styleText))}`
  }
}
