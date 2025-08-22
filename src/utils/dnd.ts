import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

export function useAppSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 }
    })
  );
}
