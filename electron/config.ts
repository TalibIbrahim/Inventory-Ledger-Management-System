import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface AppConfig {
  dbPath: string;
  mongoUri: string;
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'settings.json');

const DEFAULT_CONFIG: AppConfig = {
  dbPath: app.getPath('userData'),
  mongoUri: '', // Default to empty so they can set it themselves
};

export function getConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to read config file:', error);
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<AppConfig>) {
  try {
    const currentConfig = getConfig();
    const newConfig = { ...currentConfig, ...config };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
    return newConfig;
  } catch (error) {
    console.error('Failed to save config file:', error);
    throw error;
  }
}
