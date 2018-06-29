const fs = require('fs');
const path = require('path');

module.exports = (base, tree) => {
    fs.mkdirSync(base);
    Object.keys(tree).forEach((user) => {
        fs.mkdirSync(path.join(base, user));
        Object.keys(tree[user]).forEach((owner) => {
            fs.mkdirSync(path.join(base, user, owner));
            Object.keys(tree[user][owner]).forEach((repo) => {
                fs.mkdirSync(path.join(base, user, owner, repo));
            });
        });
    });
}