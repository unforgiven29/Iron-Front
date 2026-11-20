# Audio presentation and spatialization

Audio consumes timestamped simulation events/snapshots and never creates or changes simulation state. Render engine/airflow, weapons, explosions, radio/intercom, warnings and environment cues using presentation-only attenuation, priority, occlusion and spatialization.

Events identify sound, source entity/position/velocity, simulation tick and priority. Deduplicate, manage loop start/stop, fade stale loops, bound voices and handle missing/unlicensed assets. Asset metadata includes source/license, sample rate, channels, duration/loop points and spatialization profile.

Test event mapping, loop lifecycle, spatialization, duplicate/lost events, voice saturation, asset failure and browser audio-context lifecycle.
