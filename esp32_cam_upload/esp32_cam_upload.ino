#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>

const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASS";
const String JALUR = "c"; 
const char* server_host = "hilyatunnisa.zulfikarachyar.my.id";

unsigned long lastCapture = 0;

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void captureAndUpload() {
  camera_fb_t * fb_old = esp_camera_fb_get();
  if (fb_old) esp_camera_fb_return(fb_old);
  
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) return;

  WiFiClientSecure client;
  client.setInsecure();

  if (client.connect(server_host, 443)) {
    String boundary = "ESP32CAMBoundary";
    String head = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"image\"; filename=\"a.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
    String tail = "\r\n--" + boundary + "--\r\n";

    client.println("POST /upload/" + JALUR + " HTTP/1.1");
    client.println("Host: " + String(server_host));
    client.println("Content-Type: multipart/form-data; boundary=" + boundary);
    client.println("Content-Length: " + String(fb->len + head.length() + tail.length()));
    client.println("Connection: close\r\n");

    client.print(head);
    client.write(fb->buf, fb->len);
    client.print(tail);

    unsigned long start = millis();
    while (!client.available() && millis() - start < 7000);
    while (client.available()) client.read();
    client.stop();
  }

  esp_camera_fb_return(fb);
}

void setup() {
  Serial.begin(115200);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = psramFound() ? 10 : 12;
  config.fb_count = psramFound() ? 2 : 1;

  if (esp_camera_init(&config) != ESP_OK) return;

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  captureAndUpload();
}

void loop() {
  if (millis() - lastCapture >= 10000) {
    lastCapture = millis();
    captureAndUpload();
  }
}