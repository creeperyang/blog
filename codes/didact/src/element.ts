import { IProps } from './interface';

export const TEXT_ELEMENT = 'TEXT ELEMENT';

export function createElement(type: string, config: object, ...args: any[]) {
    const props: IProps = Object.assign({}, config);
    const hasChildren = args.length > 0;
    const rawChildren = hasChildren ? [].concat(...args) : [];
    props.children = rawChildren
        .filter((c) => c != null && c !== false)
        .map((c: any) => c instanceof Object ? c : createTextElement(c));
    return { type, props };
}

function createTextElement(value: string) {
    return createElement(TEXT_ELEMENT, { nodeValue: value });
}
