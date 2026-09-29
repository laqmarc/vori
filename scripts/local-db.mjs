import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
export function localDatabase(directory){
  mkdirSync(directory,{recursive:true});const sqlite=new DatabaseSync(resolve(directory,'vori.sqlite'));
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  const migrations=resolve(import.meta.dirname,'../drizzle');
  for(const name of readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort()){if(!sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name)){sqlite.exec(readFileSync(resolve(migrations,name),'utf8'));sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name);}}
  return {sqlite,prepare(sql){return {bind(...values){return {async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){const r=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};}};}};}};
}
