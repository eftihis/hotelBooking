const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/admin/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'admin-bundle.js'
    }
}; 