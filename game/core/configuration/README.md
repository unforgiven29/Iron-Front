# Core configuration validation

Owns configuration discovery, schema selection, validation, defaults and resolved-configuration reporting. Validate before runtime construction. Configuration is immutable during a running scenario except at an explicit reconfiguration boundary. Do not hide defaults in executable simulation code; report which layer supplied every resolved value.
