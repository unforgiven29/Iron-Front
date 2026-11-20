# Electronic support measures (ESM)

**Owner:** sensors/ESM. **Status:** design only; no ESM receiver, measurement or geolocation runtime.

ESM collects/analyzes emitted RF energy over fitted bands, associates measurements with candidate emitters and publishes uncertain bearing/geolocation reports. It does not transmit radar pulses, see radar target tracks or access a list of all entities.

Processing: receiver/aperture response → channelization → pulse/CW feature measurement → deinterleaving → emitter association → library comparison/classification → bearing/geolocation estimate → emitter report/track. Inputs are only received signals after propagation and receiver limits. Overlap, intermittent emission, frequency agility, jamming and low SNR may make identity ambiguous.

Outputs retain time, frequency/PRI/pulse-width/amplitude/bearing when observable, uncertainty, quality, candidate identities and age. Reuse RWR utilities only through contracts; mission ESM and cockpit warning policy remain distinct. Validate overlapping emitters, bearing error, own-platform motion, receiver saturation, intermittent emissions and multiple-hypothesis classification.
