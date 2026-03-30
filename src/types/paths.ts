export interface ControlPoint {
  id: string;
  position: [number, number, number];
}

export interface Path {
  id: string;
  name: string;
  points: ControlPoint[];
  closed: boolean;
  type: 'walkway' | 'road' | 'river' | 'barrier' | 'fence' | 'guide';
  width: number;
  materialId?: string;
}
