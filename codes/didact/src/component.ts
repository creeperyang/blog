import { IFiber, IProps, IState, IVNode } from './interface';
import { scheduleUpdate } from './reconciler';

/**
 * @name Component
 * @description 组件基类，定义了构造函数和 setState
 */
export class Component {
    public props: IProps;
    public state?: IState;
    // tslint:disable-next-line:variable-name
    public __fiber?: IFiber;
    constructor(props: IProps | null) {
        // 初始化 props 和 state
        this.props = props || {};
    }
    // 当子类的实例调用 setState 时，触发更新计划
    public setState(partialState: any) {
        scheduleUpdate(this, partialState);
    }
    public render(): IVNode | IVNode[] | null | undefined {
        throw new Error('subclass must implement render method.');
    }
}

/**
 * 创建组件实例
 * @param {Fiber} fiber 从fiber创建组件实例
 */
export function createInstance(fiber: IFiber) {
    const instance: Component = new (fiber.type as any)(fiber.props);
    instance.__fiber = fiber;
    return instance;
}
