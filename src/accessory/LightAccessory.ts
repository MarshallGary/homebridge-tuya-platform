import { debounce } from 'debounce';
import { PlatformAccessory } from 'homebridge';
import { TuyaDeviceFunctionEnumProperty, TuyaDeviceFunctionIntegerProperty, TuyaDeviceStatus } from '../device/TuyaDevice';
import { TuyaPlatform } from '../platform';
import BaseAccessory from './BaseAccessory';

enum LightAccessoryType {
  Unknown = -1,
  Normal = 0, // Normal Accessory, similar to SwitchAccessory, OutletAccessory.
  C = 1, // Accessory with brightness.
  CW = 2, // Accessory with brightness and color temperature (Cold and Warm).
  RGB = 3, // Accessory with color (RGB <--> HSB).
  RGBC = 4, // Accessory with color and brightness.
  RGBCW = 5, // Accessory with color, brightness and color temperature (two work mode).
}

export default class LightAccessory extends BaseAccessory {
  static readonly LightAccessoryType = LightAccessoryType;

  constructor(
    public readonly platform: TuyaPlatform,
    public readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);

    // platform.log.debug(`${JSON.stringify(this.device.functions)}, ${JSON.stringify(this.device.status)}`);
    switch (this.getAccessoryType()) {
      case LightAccessoryType.Normal:
        this.configureOn();
        break;
      case LightAccessoryType.C:
        this.configureOn();
        this.configureBrightness();
        break;
      case LightAccessoryType.CW:
        this.configureOn();
        this.configureBrightness();
        this.configureColourTemperature();
        break;
      case LightAccessoryType.RGB:
      case LightAccessoryType.RGBC:
        this.configureOn();
        this.configureBrightness();
        this.configureHue();
        this.configureSaturation();
        break;
      case LightAccessoryType.RGBCW:
        this.configureOn();
        this.configureBrightness();
        this.configureColourTemperature();
        this.configureHue();
        this.configureSaturation();
        break;
    }
  }

  getMainService() {
    return this.accessory.getService(this.Service.Lightbulb)
    || this.accessory.addService(this.Service.Lightbulb);
  }

  getAccessoryType() {
    const on = this.getOnDeviceFunction();
    const bright = this.getBrightnessDeviceFunction();
    const temp = this.getColorTemperatureDeviceFunction();
    const color = this.getColorDeviceFunction();
    const mode = this.device.getDeviceFunctionProperty('work_mode') as TuyaDeviceFunctionEnumProperty;
    const { h, s, v } = (color ? this.device.getDeviceFunctionProperty(color.code) : {}) as never;

    let accessoryType: LightAccessoryType;
    if (on && bright && temp && h && s && v && mode && mode.range.includes('colour') && mode.range.includes('white')) {
      accessoryType = LightAccessoryType.RGBCW;
    } else if (on && bright && !temp && h && s && v && mode && mode.range.includes('colour') && mode.range.includes('white')) {
      accessoryType = LightAccessoryType.RGBC;
    } else if (on && !temp && h && s && v) {
      accessoryType = LightAccessoryType.RGB;
    } else if (on && bright && temp && !color) {
      accessoryType = LightAccessoryType.CW;
    } else if (on && bright && !temp && !color) {
      accessoryType = LightAccessoryType.C;
    } else if (on && !bright && !temp && !color) {
      accessoryType = LightAccessoryType.Normal;
    } else {
      accessoryType = LightAccessoryType.Unknown;
    }

    return accessoryType;
  }

  getOnDeviceFunction() {
    const onFunction = this.device.getDeviceFunction('switch_led')
      || this.device.getDeviceFunction('switch_led_1');
    return onFunction;
  }

  getBrightnessDeviceFunction() {
    const brightFunction = this.device.getDeviceFunction('bright_value')
      || this.device.getDeviceFunction('bright_value_v2')
      || this.device.getDeviceFunction('bright_value_1');
    return brightFunction;
  }

  getColorTemperatureDeviceFunction() {
    const tempFunction = this.device.getDeviceFunction('temp_value')
      || this.device.getDeviceFunction('temp_value_v2');
    return tempFunction;
  }

  getColorDeviceFunction() {
    const colorFunction = this.device.getDeviceFunction('colour_data')
      || this.device.getDeviceFunction('colour_data_v2');
    return colorFunction;
  }

  getWorkModeDeviceFunction() {
    const modeFunction = this.device.getDeviceFunction('work_mode');
    return modeFunction;
  }

  getColorValue() {
    const colorFunction = this.getColorDeviceFunction();
    const status = this.device.getDeviceStatus(colorFunction!.code);
    if (!status || !status.value || status.value === '' || status.value === '{}') {
      return { h: 0, s: 0, v: 0 };
    }

    const { h, s, v } = JSON.parse(status.value as string);
    return {
      h: h as number,
      s: s as number,
      v: v as number,
    };
  }

  getColorProperty() {
    const colorFunction = this.getColorDeviceFunction()!;
    const property = this.device.getDeviceFunctionProperty(colorFunction.code)!;
    return {
      h: property['h'] as TuyaDeviceFunctionIntegerProperty,
      s: property['s'] as TuyaDeviceFunctionIntegerProperty,
      v: property['v'] as TuyaDeviceFunctionIntegerProperty,
    };
  }

  inWhiteMode() {
    const mode = this.getWorkModeDeviceFunction();
    if (!mode) {
      return false;
    }
    const status = this.device.getDeviceStatus(mode.code);
    if (!status) {
      return false;
    }
    return (status.value === 'white');
  }

  inColorMode() {
    const mode = this.getWorkModeDeviceFunction();
    if (!mode) {
      return false;
    }
    const status = this.device.getDeviceStatus(mode.code);
    if (!status) {
      return false;
    }
    return (status.value === 'colour');
  }

  configureOn() {
    const service = this.getMainService();
    const onFunction = this.getOnDeviceFunction()!;

    service.getCharacteristic(this.Characteristic.On)
      .onGet(() => {
        const status = this.device.getDeviceStatus(onFunction.code);
        return !!status && status!.value;
      })
      .onSet((value) => {
        this.log.debug(`Characteristic.On set to: ${value}`);
        this.addToSendQueue([{ code: onFunction.code, value: value as boolean }]);
      });
  }

  configureBrightness() {
    const service = this.getMainService();

    service.getCharacteristic(this.Characteristic.Brightness)
      .onGet(() => {

        // Color mode, get brightness from hsv
        if (this.inColorMode()) {
          const { max } = this.getColorProperty().v;
          const brightStatus = this.getColorValue().v;
          const brightPercent = brightStatus / max;
          return Math.floor(brightPercent * 100);
        }

        const brightFunction = this.getBrightnessDeviceFunction()!;
        const { max } = this.device.getDeviceFunctionProperty(brightFunction.code) as TuyaDeviceFunctionIntegerProperty;
        const brightStatus = this.device.getDeviceStatus(brightFunction.code)!;
        const brightPercent = brightStatus.value as number / max;
        return Math.floor(brightPercent * 100);
      })
      .onSet((value) => {
        this.log.debug(`Characteristic.Brightness set to: ${value}`);

        // Color mode, set brightness to hsv
        if (this.inColorMode()) {
          const { max } = this.getColorProperty().v;
          const colorFunction = this.getColorDeviceFunction()!;
          const colorValue = this.getColorValue();
          colorValue.v = Math.floor(value as number * max / 100);
          this.addToSendQueue([{ code: colorFunction.code, value: JSON.stringify(colorValue) }]);
          return;
        }

        const brightFunction = this.getBrightnessDeviceFunction()!;
        const { max } = this.device.getDeviceFunctionProperty(brightFunction.code) as TuyaDeviceFunctionIntegerProperty;
        const brightValue = Math.floor(value as number * max / 100);
        this.addToSendQueue([{ code: brightFunction.code, value: brightValue }]);
      });

  }

  configureColourTemperature() {
    const service = this.getMainService();
    const tempFunction = this.getColorTemperatureDeviceFunction()!;
    const { min, max } = this.device.getDeviceFunctionProperty(tempFunction.code) as TuyaDeviceFunctionIntegerProperty;

    service.getCharacteristic(this.Characteristic.ColorTemperature)
      .onGet(() => {
        const tempStatus = this.device.getDeviceStatus(tempFunction.code)!;
        let miredValue = Math.floor(1000000 / ((tempStatus.value as number - min) * (7142 - 2000) / (max - min) + 2000));
        miredValue = Math.max(140, miredValue);
        miredValue = Math.min(500, miredValue);
        return miredValue;
      })
      .onSet((value) => {
        this.log.debug(`Characteristic.ColorTemperature set to: ${value}`);
        const temp = Math.floor((1000000 / (value as number) - 2000) * (max - min) / (7142 - 2000) + min);
        const commands: TuyaDeviceStatus[] = [{
          code: tempFunction.code,
          value: temp,
        }];

        const mode = this.getWorkModeDeviceFunction();
        if (mode) {
          commands.push({ code: 'work_mode', value: 'white' });
        }

        this.addToSendQueue(commands);
      });

  }

  configureHue() {
    const service = this.getMainService();
    const colorFunction = this.getColorDeviceFunction()!;
    const { min, max } = this.getColorProperty().h;
    service.getCharacteristic(this.Characteristic.Hue)
      .onGet(() => {
        // White mode, return fixed Hue 0
        if (this.inWhiteMode()) {
          return 0;
        }

        let hue = Math.floor(360 * (this.getColorValue().h - min) / (max - min));
        hue = Math.max(0, hue);
        hue = Math.min(360, hue);
        return hue;
      })
      .onSet((value) => {
        this.log.debug(`Characteristic.Hue set to: ${value}`);
        const colorValue = this.getColorValue();
        colorValue.h = Math.floor((value as number / 360) * (max - min) + min);
        const commands: TuyaDeviceStatus[] = [{
          code: colorFunction.code,
          value: JSON.stringify(colorValue),
        }];

        const mode = this.getWorkModeDeviceFunction();
        if (mode) {
          commands.push({ code: 'work_mode', value: 'colour' });
        }

        this.addToSendQueue(commands);
      });
  }

  configureSaturation() {
    const service = this.getMainService();
    const colorFunction = this.getColorDeviceFunction()!;
    const { min, max } = this.getColorProperty().s;
    service.getCharacteristic(this.Characteristic.Saturation)
      .onGet(() => {
        // White mode, return fixed Saturation 0
        if (this.inWhiteMode()) {
          return 0;
        }

        let saturation = Math.floor(100 * (this.getColorValue().s - min) / (max - min));
        saturation = Math.max(0, saturation);
        saturation = Math.min(100, saturation);
        return saturation;
      })
      .onSet((value) => {
        this.log.debug(`Characteristic.Saturation set to: ${value}`);
        const colorValue = this.getColorValue();
        colorValue.s = Math.floor((value as number / 100) * (max - min) + min);
        const commands: TuyaDeviceStatus[] = [{
          code: colorFunction.code,
          value: JSON.stringify(colorValue),
        }];

        const mode = this.getWorkModeDeviceFunction();
        if (mode) {
          commands.push({ code: 'work_mode', value: 'colour' });
        }

        this.addToSendQueue(commands);
      });
  }

  sendQueue: TuyaDeviceStatus[] = [];
  debounceSendCommands = debounce(async () => {
    await this.deviceManager.sendCommands(this.device.id, this.sendQueue);
    this.sendQueue = [];
  }, 100);

  addToSendQueue(commands: TuyaDeviceStatus[]) {
    for (const newStatus of commands) {
      // Update cache immediately
      const oldStatus = this.device.status.find(_status => _status.code === newStatus.code);
      if (oldStatus) {
        oldStatus.value = newStatus.value;
      }

      // Update send queue
      const queueStatus = this.sendQueue.find(_status => _status.code === newStatus.code);
      if (queueStatus) {
        queueStatus.value = newStatus.value;
      } else {
        this.sendQueue.push(newStatus);
      }
    }

    this.debounceSendCommands();
  }
}
