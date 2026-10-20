import {proxyGas} from '../_lib/gas.js';
export function onRequestGet({env}) { return proxyGas('matches', env); }
