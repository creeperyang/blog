const path = require('path')
// const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')
// const ExtractTextPlugin = require('extract-text-webpack-plugin')
// const isProduction = process.argv.indexOf('-p') >= 0
const CopyWebpackPlugin = require('copy-webpack-plugin')

const commonConfig = {
    entry: {
        app: [
            // 'babel-polyfill',
            path.join(__dirname, '../client/index.js')
        ],
        vendor: ['react', 'react-router-dom', 'redux', 'react-dom', 'react-redux']
    },
    target: 'web',
    output: {
        path: path.join(__dirname, '../dist'),
        filename: '[name].[hash].js',
        chunkFilename: '[name].[hash].js',
        publicPath: '/'
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                use: ['babel-loader?cacheDirectory=true'],
                include: path.join(__dirname, '../client')
            },
            // css
            {
                test: /\.(less|css)$/,
                exclude: /node_modules/,
                use: [{
                        loader: 'style-loader'
                    },
                    {
                        loader: 'css-loader',
                        options: {
                            minimize: false,
                        },
                    },
                    {
                        loader: 'postcss-loader'
                    },
                    {
                        loader: 'less-loader',
                        options: {
                            strictMath: true,
                            noIeCompat: true
                        }
                    },
                ]
                // use: ExtractTextPlugin.extract({
                //     fallback: 'style-loader',
                //     use: [
                //         {
                //             loader: 'css-loader'
                //         },
                //         {
                //             loader: 'less-loader',
                //             options: {
                //                 strictMath: true,
                //                 noIeCompat: true
                //             }
                //         },
                //     ]
                // })
            },
            {
                test: /\.(png|jpg|gif)$/,
                use: [{
                    loader: 'url-loader',
                    options: {
                        limit: 8192
                    }
                }]
            }
        ]
    },
    plugins: [
        // new webpack.HashedModuleIdsPlugin(),
        // new CopyWebpackPlugin([{
        //         from: './client/jump.html',
        //         to: path.join(__dirname, './dist'),
        //         toType: 'dir'
        //     },
        //     {
        //         from: './client/blank.html',
        //         to: path.join(__dirname, './dist'),
        //         toType: 'dir'
        //     }
        // ], {}),
    ],
    // optimization: {
    //     splitChunks: {
    //         name: true,
    //         cacheGroups: {
    //             commons: {
    //                 chunks: 'initial',
    //                 minChunks: 2
    //             },
    //             vendors: {
    //                 test: /[\\/]node_modules[\\/]/,
    //                 chunks: 'all',
    //                 priority: -10
    //             }
    //         }
    //     },
    //     runtimeChunk: true
    // },
    resolve: {
        extensions: ['.js', '.jsx'],
        alias: {
            '@': path.join(__dirname, '../client/'),
        }
    },
    node: {
        // workaround for webpack-dev-server issue
        // https://github.com/webpack/webpack-dev-server/issues/60#issuecomment-103411179
        fs: 'empty',
        net: 'empty'
    }
};

module.exports = commonConfig;
