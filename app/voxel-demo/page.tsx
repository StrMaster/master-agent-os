import type { Metadata } from 'next';
import VoxelWorld from './voxel-world';

export const metadata: Metadata = {
  title: 'Voxel Construction Demo | Master Agent OS',
  description: 'Interactive procedural voxel construction prototype.',
};

export default function VoxelDemoPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">
          Experimental build
        </p>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Voxel Construction Demo</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">
          A small 3D house generated entirely in code. Switch construction stages, rotate the camera,
          and remove individual building pieces.
        </p>
      </div>

      <VoxelWorld />
    </div>
  );
}
