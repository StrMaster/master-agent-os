type CoordinationEvent = {
  timestamp: number;

  agent: string;

  type: string;

  summary: string;
};

const coordinationMemory:
  CoordinationEvent[] = [];

export function addCoordinationEvent(
  event: CoordinationEvent
) {
  coordinationMemory.unshift(event);

  if (
    coordinationMemory.length > 100
  ) {
    coordinationMemory.pop();
  }
}

export function getCoordinationMemory() {
  return coordinationMemory;
}