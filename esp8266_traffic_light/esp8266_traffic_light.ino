#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#define WIFI_SSID     "vivoY36"
#define WIFI_PASSWORD "12345678"
#define FIREBASE_HOST "YOUR_FIREBASE_HOST"
#define FIREBASE_API_KEY "YOUR_API_KEY"

const int PINS[3][3] = {
  {D0, D1, D2}, // Lane A
  {D3, D4, D5}, // Lane B
  {D6, D7, D8}  // Lane C
};

const char* LANES[3] = {"lane_a", "lane_b", "lane_c"};

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool signupOK = false;
unsigned long lastFetch = 0;

void setLaneLED(int r, int y, int g, String status) {
  digitalWrite(r, status == "RED" || (status != "GREEN" && status != "YELLOW"));
  digitalWrite(y, status == "YELLOW");
  digitalWrite(g, status == "GREEN");
}

void setup() {
  Serial.begin(115200);

  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      pinMode(PINS[i][j], OUTPUT);
      digitalWrite(PINS[i][j], j == 0 ? HIGH : LOW);
    }
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(300);

  config.api_key = FIREBASE_API_KEY;
  config.database_url = "https://" FIREBASE_HOST;

  if (Firebase.signUp(&config, &auth, "", "")) signupOK = true;

  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (!signupOK || !Firebase.ready()) return;

  if (millis() - lastFetch >= 1000) {
    lastFetch = millis();

    for (int i = 0; i < 3; i++) {
      String path = "/traffic_lights/" + String(LANES[i]);
      String status = "RED";

      if (Firebase.RTDB.getString(&fbdo, path + "/light_status")) {
        status = fbdo.stringData();
        status.toUpperCase();
      }

      setLaneLED(PINS[i][0], PINS[i][1], PINS[i][2], status);
    }
  }
}