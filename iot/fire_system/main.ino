#include "DHT.h"

// ===== Pins =====
#define FLAME_PIN 27
#define MQ2_PIN 26
#define DHT_PIN 4
#define LED_PIN 2
#define BUZZER_PIN 5

#define DHTTYPE DHT22

DHT dht(DHT_PIN, DHTTYPE);

// ===== Variables =====
float baseTemp = 0;
float prevTemp = 0;

void setup() {
  Serial.begin(115200);

  pinMode(FLAME_PIN, INPUT);
  pinMode(MQ2_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW); // stop random buzz

  dht.begin();

  // ESP32 v3 PWM setup
  ledcAttach(BUZZER_PIN, 2000, 8);

  delay(2000);

  baseTemp = dht.readTemperature();
  prevTemp = baseTemp;

  Serial.println("🔥 FIRE SYSTEM READY 🚨");
}

void loop() {
  int flame = digitalRead(FLAME_PIN);   // LOW = flame
  int gas = digitalRead(MQ2_PIN);       // LOW = gas
  float temp = dht.readTemperature();

  if (isnan(temp)) {
    Serial.println("DHT error!");
    delay(500);
    return;
  }

  // ===== Dynamic baseline =====
  baseTemp = 0.95 * baseTemp + 0.05 * temp;

  float tempRise = temp - baseTemp;
  float tempChange = temp - prevTemp;

  bool flameDetected = (flame == LOW);
  bool gasDetected = (gas == LOW);
  bool tempRising = (tempRise > 2.0 || tempChange > 0.5);

  // ===== Debug =====
  Serial.print("Temp: "); Serial.print(temp);
  Serial.print(" | Rise: "); Serial.print(tempRise);
  Serial.print(" | Flame: "); Serial.print(flameDetected);
  Serial.print(" | Gas: "); Serial.println(gasDetected);

  // ===== FIRE LOGIC =====
  if (flameDetected) {
    Serial.println("🔥 FIRE: Flame!");
    digitalWrite(LED_PIN, HIGH);

    // 🚨 Siren
    ledcWriteTone(BUZZER_PIN, 1000);
    delay(200);
    ledcWriteTone(BUZZER_PIN, 2000);
    delay(200);
  }
  else if (gasDetected && tempRising) {
    Serial.println("🔥 FIRE: Smoke + Heat!");
    digitalWrite(LED_PIN, HIGH);

    // 🚨 Siren
    ledcWriteTone(BUZZER_PIN, 1200);
    delay(300);
    ledcWriteTone(BUZZER_PIN, 1800);
    delay(300);
  }
  else {
    digitalWrite(LED_PIN, LOW);
    ledcWriteTone(BUZZER_PIN, 0); // stop buzzer
  }

  prevTemp = temp;

  delay(500);
}