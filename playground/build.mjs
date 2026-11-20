// Builds the Playground runtimes into playground/artifacts/web.
//
//   node playground/build.mjs [--reactive-repo <path>] [--quest-repo <path>] [--rebuild-yoga] [--skip-quest]

import {statSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {PATHS, listFiles} from './scripts/common.mjs';
import {fetchDeps} from './scripts/deps.mjs';
import {buildPc} from './scripts/pc.mjs';
import {buildQuest} from './scripts/quest.mjs';

const {values: args} = parseArgs({
    options: {
        'reactive-repo': {type: 'string'},
        'quest-repo': {type: 'string'},
        'rebuild-yoga': {type: 'boolean', default: false},
        'skip-quest': {type: 'boolean', default: false},
    },
});

async function main() {
    fetchDeps({
        reactiveRepo: args['reactive-repo'],
        questRepo: args['quest-repo'],
        skipQuest: args['skip-quest'],
    });

    buildPc({
        rebuildYoga: args['rebuild-yoga']
    });

    if (!args['skip-quest']) {
        await buildQuest();
    }

    const size = listFiles(PATHS.web).reduce((total, file) => total + statSync(file).size, 0);
    console.log(`Built ${PATHS.web} (${(size / 1048576).toFixed(1)} MB)`);
}

try {
    await main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
