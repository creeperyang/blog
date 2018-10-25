const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

let ID = 0;

function createAsset(filename) {
    if (path.extname(filename) === '') {
        filename += '.js';
    }
    const content = fs.readFileSync(filename, { encoding: 'utf8' });
    const deps = [];
    const id = ID++;
    const ast = parser.parse(content, {
        sourceType: 'module'
    });

    traverse(ast, {
        enter(path) {
            if (path.node.type === 'ImportDeclaration') {
                deps.push(path.node.source.value);
            }
        }
    });

    const code = babel.transformFromAstSync(ast, content, {
        presets: [['@babel/preset-env']]
    }).code;

    return {
        id,
        filename,
        ast,
        code,
        deps
    }
}

function createGraph(entry) {
    const mainAsset = createAsset(
        path.isAbsolute(entry) ? entry : path.resolve(entry)
    );
    const queue = [mainAsset];

    for(const asset of queue) {
        const dirname = path.dirname(asset.filename);
        
        asset.mapping = {};

        asset.deps.forEach(relativePath => {
            const absolutePath = path.join(dirname, relativePath);

            const child = createAsset(absolutePath);

            asset.mapping[relativePath] = child.id;

            queue.push(child);
        });
    }
    return queue;
}

function bundle(graph) {
    let modules = '';

    graph.forEach(mod => {
        modules += `${mod.id}: [
            function (require, module, exports) {
                ${mod.code}
            },
            ${JSON.stringify(mod.mapping)}
        ],`;
    });

    const result = `
        (function(modules) {
            function require(id) {
                const [fn, mapping] = modules[id];

                function localRequire(relativePath) {
                    return require(mapping[relativePath])
                }

                const module = { exports: {} };

                fn(localRequire, module, module.exports);

                return module.exports;
            }

            require(0);
        })({${modules}})
    `;

    return result;
}

const graph = createGraph('./demo/entry.js');

const result = bundle(graph);

eval(result)
