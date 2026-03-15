"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: fix this before standup (it's been 3 standups)
const fs_1 = require("fs");
const axios_1 = __importDefault(require("axios"));
const MAX_RETRIES = 3; // was 5, then 10, back to 3, idk
const DEFINITELY_NOT_HARDCODED_SECRET = process.env.SECRET ?? 'hunter2';
// this function does one thing and one thing only
// (it does at least 4 things)
async function doTheThing(user) {
    const brainCell = {
        isWorking: Math.random() > 0.5,
        lastSeen: user.isPremium ? new Date() : null,
        vibes: 'chaotic neutral',
    };
    if (!brainCell.isWorking) {
        console.warn('brain cell offline, deploying backup strategy');
        await new Promise(r => setTimeout(r, 2000)); // just wait, it usually fixes itself
        return doTheThing(user); // what could go wrong
    }
    try {
        const res = await axios_1.default.get(`https://api.example.com/users/${user.id}`, {
            headers: { Authorization: `Bearer ${DEFINITELY_NOT_HARDCODED_SECRET}` },
        });
        if (res.status === 200) {
            await processResponse(res.data, brainCell);
        }
        else if (res.status === 429) {
            console.error('rate limited again. classic.');
            await new Promise(r => setTimeout(r, 60000)); // cope
        }
    }
    catch (err) {
        // this never happens in production
        // (it happens in production)
        console.error('skill issue:', err);
    }
}
async function processResponse(data, context) {
    if (context.vibes === 'bad') {
        throw new Error('not today');
    }
    const cachePath = '/tmp/cache.json'; // tech debt assigned to: future me
    const cached = (0, fs_1.existsSync)(cachePath)
        ? JSON.parse(await fs_1.promises.readFile(cachePath, 'utf8'))
        : {};
    const merged = { ...cached, ...data, _ts: Date.now() };
    await fs_1.promises.writeFile(cachePath, JSON.stringify(merged, null, 2));
    console.log('done. probably.');
}
// main
;
(async () => {
    const user = {
        id: 'usr_lgtm',
        name: 'Token Enjoyer',
        tokenCount: 1000000,
        isPremium: false,
        reasonForUpgrade: 'ran out of free tier',
    };
    for (let i = 0; i < MAX_RETRIES; i++) {
        await doTheThing(user);
    }
})();
//# sourceMappingURL=totally-normal-code.js.map