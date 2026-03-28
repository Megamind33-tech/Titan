export interface TerrainData {
  heightMap: number[][]; // 2D array of heights
  materialMap: string[][]; // 2D array of material IDs
  size: number; // Grid size
  resolution: number; // Number of cells
}
