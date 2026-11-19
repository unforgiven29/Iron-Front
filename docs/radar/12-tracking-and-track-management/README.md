# 12 — Tracking and Track Management

## Purpose
Convert intermittent detections into persistent estimates of object state while representing uncertainty and association errors.

## Categories
- **Track initiation:** tentative tracks, initiation criteria, and protection from isolated false alarms.
- **Measurement association:** gating, nearest-neighbor methods, probabilistic association, and ambiguity management.
- **State estimation:** alpha-beta, Kalman, extended/unscented Kalman, and other suitable estimators.
- **State representation:** position, velocity, acceleration, coordinate frame, covariance, and timestamp.
- **Track confirmation:** evidence accumulation, confirmation thresholds, and time-to-confirm.
- **Track maintenance:** update intervals, quality, classification confidence, and source history.
- **Coasting:** temporary loss of detections, prediction-only updates, uncertainty growth, and coast limits.
- **Track splitting/merging:** crossing targets, merged returns, formation separation, and duplicate handling.
- **Track deletion:** stale tracks, invalid estimates, quality decay, and resource limits.
- **Track classification:** broad category and identity confidence without treating classification as certainty.
- **Track capacity:** finite processing/display capacity, priority, and overload behavior.

## Interactions
Tracks reflect missed detections, false alarms, scan scheduling, maneuvers, and measurement uncertainty. A track is an estimate, not perfect knowledge.

## Boundary
Manages persistent estimates. It must not alter targets or force detections into existence.
