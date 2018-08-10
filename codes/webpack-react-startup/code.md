1. debounce & throttle

debounce：延后一定时间再执行，如果等待期再次触发，重新计时。

适用于`resize`事件回调，我们希望resize结束后若干毫秒再去执行函数，而不是每次触发`resize`时都执行。

```js
function debounce(fn, wait) {
    if (typeof fn !== 'function') {
        throw new Error('fn should be function');
    }
    wait = Number(wait) || 100;
    let id;
    return function debounced(...args) {
        if (id) {
            clearTimeout(id);
        }
        id = setTimeout(() => {
            fn(...args);
        }, wait);
    }
}
```

throttle：按一定节奏执行。即设定一个执行周期，当调用时时间间隔大于设定值，则执行，并进入下个周期。

```js
function throttle(fn, wait) {
    if (typeof fn !== 'function') {
        throw new Error('fn should be function');
    }
    wait = Number(wait) || 100;
    let id;
    let previous = 0;
    let result;
    return function throttled(...args) {
        const now = Date.now();
        if (!previous) previous = now;
        const remaining = wait - (now - previous);
        console.log(remaining, format(now), format(previous))
        if (remaining <= 0) {
            if (id) {
                clearTimeout(id);
                id = null;
            }
            previous = now;
            result = fn(...args);
        } else if (!id) {
            id = setTimeout(() => {
                result = fn(...args);
                previous = Date.now();
                id = null;
            }, remaining);
        }
        return result;
    }
}
```



> webpack>=4.0

`webpack` 升级到 4 之后，变化还是很大的，下面的内容除非特别声明，一般对应 4.0 以上。

首先，我们还是从 Long term cache 和 code split 来学习`webpack@4`的最新用法。

#### hash vs chunkhash

- hash：build-specific，对全部内容计算，每次内容变化（代码更新）时（触发重新build）都会有新的hash值。

    1. <img width="851" alt="2018-08-10 3 44 24" src="https://user-images.githubusercontent.com/8046480/43949020-fef57af0-9cbe-11e8-84cc-c7fdeab36e54.png">

    2. <img width="891" alt="2018-08-10 3 44 05" src="https://user-images.githubusercontent.com/8046480/43949223-82312752-9cbf-11e8-9d0b-b4d932c5345b.png">

    所有文件使用同一个hash；改了一行代码后，前后两次build的hash改变。

- chunkhash：chunk-specific，对单个chunk计算，未变化的chunk的hash不变。

所以一般我们可以在生产中使用`chunkhash`来尽可能利用缓存。但这里有个问题，`chunkhash`在实际使用中表现的不稳定。

