# Tracked vehicle mobility

**Owner:** physics/ground-mobility/tracks. Platform data supplies track geometry, sprocket/idler/road-wheel layout, width/contact length, tension, drive ratio and limits.

Compute track-ground contact and longitudinal/lateral force through soil/surface parameters, normal load, slip and track/drive state. Steering arises from differential/braked track torque or exact platform mechanism. Track break, thrown track, sprocket/roller damage and tension change are localized failures.

Do not use a generic speed multiplier for mud/sand/grade. Publish traction/force limits and slip. Validate straight pull, turning, pivot turn, cross-slope, soft soil, partial track loss and deterministic contact.
