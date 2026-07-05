import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const requiredTables=['inventory_items','item_attachments','valuation_records','comparable_listings','incidents','incident_items','app_settings'];

export async function shareDatabaseBackup(db:SQLiteDatabase){if(!await Sharing.isAvailableAsync())throw new Error('Sharing is not available on this device.');const bytes=await db.serializeAsync();const file=new File(Paths.cache,`ProofVault_database_${new Date().toISOString().slice(0,10)}_${Date.now()}.sqlite`);file.create();file.write(bytes);await Sharing.shareAsync(file.uri,{mimeType:'application/vnd.sqlite3',dialogTitle:'Save ProofVault database backup',UTI:'public.database'});}

export async function pickDatabaseBackup(){const result=await DocumentPicker.getDocumentAsync({type:['application/vnd.sqlite3','application/x-sqlite3','application/octet-stream'],copyToCacheDirectory:true,multiple:false});if(result.canceled)return undefined;return await new File(result.assets[0].uri).bytes();}

export async function restoreDatabaseBackup(db:SQLiteDatabase,bytes:Uint8Array){const header=new TextDecoder().decode(bytes.slice(0,16));if(!header.startsWith('SQLite format 3'))throw new Error('This file is not a valid SQLite database.');const imported=await SQLite.deserializeDatabaseAsync(bytes);try{const integrity=await imported.getFirstAsync<{integrity_check:string}>('PRAGMA integrity_check');if(integrity?.integrity_check!=='ok')throw new Error('The backup failed its SQLite integrity check.');const tables=await imported.getAllAsync<{name:string}>("SELECT name FROM sqlite_master WHERE type='table'");const names=new Set(tables.map(table=>table.name));if(requiredTables.some(table=>!names.has(table)))throw new Error('This is not a complete ProofVault database backup.');await SQLite.backupDatabaseAsync({sourceDatabase:imported,sourceDatabaseName:'main',destDatabase:db,destDatabaseName:'main'});}finally{await imported.closeAsync();}}
