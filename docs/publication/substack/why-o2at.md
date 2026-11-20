# Why propose another optical audio transport?

The proposal starts with a practical gap: domestic optical links are simple, but their common format envelope and one-way clock relationship are narrow.

TOSLINK solved a useful problem. A fibre connection can avoid a conductive path between the two audio ports, and a correctly implemented link can deliver its supported stream without errors. O2AT should not dismiss that installed base to make a case for change.

The question is whether a standard pluggable optical module and ordinary Ethernet framing can carry a broader, negotiated audio stream while keeping conversion timing under receiver control. The v0.2 answer is a proposal built around 1G SFP, a fixed header, capability exchange, receiver credits and an elastic FIFO.

That architecture has costs. Two endpoints must agree on framing, session state, loss handling and capability declarations. A bridged Ethernet domain requires admission control. An endpoint must still prove that its USB, FPGA, DAC and clock hardware can accept and deliver the requested mode.

The bandwidth tables are calculations, not listening tests. They account for Ethernet overhead and compare with MAC service. They do not establish latency bounds through an arbitrary switch, clock-noise performance or an audible benefit.

The next step is not a claim of superiority. It is a reproducible implementation that independent teams can build, inspect and measure against the published vectors.
