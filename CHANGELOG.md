# Changelog

## v1.6.0-beta.x

### Changed
- Rewritten in TypeScript, brings benefits of type checking, smart code hints, etc.
- Reimplement accessory logics. More friendly for accessory developers. (old accessory class still compatible to use yet)
- Update device info list polling logic. Less errors.
- Add `AMERICA_EAST` and `EUROPE_WEST` endpoints.
- Add config validation on plugin start.
- Add `device manufactor`, `serial number` (device id) and `model` displayed in HomeKit.
- All devices will be shown in HomeKit by default. (Including unsupported device)
- Add GitHub action `Build and Lint`.
- Remove `debug` option. Silence logs for users. For developers who wants to debugging, please start homebridge in debug mode: `homebridge -D`
- Remove `lang` option.
- Update unit test.
- For `Custom` project type, some API has switched to the same as `Smart Home`.
- Rewrite the `Custom` project start process. User will be created and authorized automatically.

### Fixed
- 1004 signature error when url query has more than 2 elements.
- 1010 token expired error when refresh access_token.
- 1106 permission error when polling device info list.
- 1100, 2017 errors when login. (via config validation)
- Fix access_token undefined error. (https://github.com/tuya/tuya-homebridge/issues/298#issuecomment-1278238870 by @Azukovskij )

### Accessory category specific
- Rewrite `BaseAccessory`, `SwitchAccessory`, `OutletAccessory`, `LightAccessory`, `ContactSensorAccessory`, `LeakSensorAccessory`, `SmokeSensorAccessory`, `GarageDoorAccessory`, `WindowCoveringAccessory`, `FanAccessory` reduce about 50% code size. Now writing a accessory class is much more simple.
- Legacy accessory codes moved to `src/accessory/legacy/` folder.
- [Light] Add `debounce` and command send queue, more stable during frequent operations on different characteristics.
- [Light] Fix wrong color temperature map. (https://github.com/tuya/tuya-homebridge/issues/136 by @XiaoTonyLuo and https://github.com/tuya/tuya-homebridge/pull/135 by @levidhuyvetter)
- [Light] Color mode and white mode switching should be working now.
- [CarbonMonoxideSensor] Add CO Detector support (`cobj`).
- [CarbonDioxideSensor] Add CO2 Detector support (`co2bj`).
- [LeakSensor] Add Water Detector support (`sj`).
- [TemperatureSensor/HumiditySensor] Add Temperature and Humidity Sensor support (`wsdcg`).
- [LightSensor] Add Light Sensor support (`ldcg`).
- [MotionSensor] Add Motion Sensor support (`pir`).
- [AirQualitySensor] Add PM2.5 Detector support (`pm25`).
- [Window] Add Door and Window Controller support (`mc`).
- [Window] Add Curtain Switch support (`clkg`).
- [OccupancySensor] Add Human Presence Sensor support (`hps`).
- [Thermostat] Add Thermostat support (`wk`).
- [Light] Add Spotlight support (`sxd`).
- [Valve] Add Irrigator support (`ggq`).
- [Fanv2] Add Ceiling Fan Light support (`fsd`).

### Known issue
- Sometimes mqtt not respond quickly, the older message received later than newer one. This will influence the accessory status update.
