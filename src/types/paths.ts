export interface ControlPoint {
  id: string;
  position: [number, number, number];
}

export interface Path {
  id: string;
  authoredId?: string;  // Stable round-trip ID, generated like model.authoredId
  name: string;
  points: ControlPoint[];
  closed: boolean;
  type: 'walkway' | 'road' | 'river' | 'barrier' | 'fence' | 'guide';
  width: number;
  materialId?: string;
}
