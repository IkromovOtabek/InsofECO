export abstract class SmsPort {
  abstract send(phone: string, text: string): Promise<void>;
}
