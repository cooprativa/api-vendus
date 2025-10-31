// app/utils/FileSystemUtils.js
import { promises as fs } from "fs";
import { DATA_DIR } from "../constants/monitor";

export class FileSystemUtils {
  static async ensureDataDirectory() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
      console.error("Failed to create data directory:", error);
      throw error;
    }
  }

  static async readJsonFile(filePath, defaultValue = null) {
    try {
      await this.ensureDataDirectory();
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.log(`No file found at ${filePath}, using default:`, defaultValue);
      return defaultValue;
    }
  }

  static async writeJsonFile(filePath, data) {
    try {
      await this.ensureDataDirectory();
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Failed to write file ${filePath}:`, error);
      throw error;
    }
  }
}
