# Spatial services and coordinate transforms

Provides named coordinate frames, transforms, spatial indexing and general-purpose queries. It does not own terrain truth, sensor physics or renderer visibility. All points/vectors/orientations/bounds declare frame and units. Sensor line-of-sight uses world/physics services; visual occlusion is not a substitute for physical propagation or collision.

**Status:** Architecture specification only.
