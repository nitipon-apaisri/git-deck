import { contextBridge } from 'electron'

// The typed IPC surface is added in phase 4.
contextBridge.exposeInMainWorld('api', {})
