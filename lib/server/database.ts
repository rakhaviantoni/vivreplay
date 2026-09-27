import {env} from 'cloudflare:workers';

export function database(){if(!env.DB)throw new Error('Persistent storage is unavailable. Please retry shortly.');return env.DB;}
