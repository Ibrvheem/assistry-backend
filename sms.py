import requests
url = "https://v3.api.termii.com/api/sms/send"
payload = {
          "to": "2348108394272",
           "from": "FINTA",
           "sms": "Hi there, testing FINTA ",
           "type": "plain",
           "channel": "generic",
           "api_key": "TLKxBzxDTzFtGjiLOSdHHynnxIMTEnZzYolVYBcvLxpEnlUwrHAqQyNuMQAxfZ",
       }
headers = {
'Content-Type': 'application/json',
}
response = requests.request("POST", url, headers=headers, json=payload)
print(response.text)


print("FOR OTP")
import requests
url = "https://v3.api.termii.com/api/sms/otp/send"
payload = {
           "message_type": 'NUMERIC',
      "to": "2348108394272",
      'from': 'FINTA',
      'channel': 'generic',
      'pin_attempts': 3,
      'pin_time_to_live': 5,
      'pin_length': 6,
      'pin_placeholder': '< 123478>',
      'message_text': 'Your OTP code to authenticate your transaction is < 123478>',
      'pin_type': 'NUMERIC',
      "api_key": "TLKxBzxDTzFtGjiLOSdHHynnxIMTEnZzYolVYBcvLxpEnlUwrHAqQyNuMQAxfZ",
       }
headers = {
'Content-Type': 'application/json',
}
response = requests.request("POST", url, headers=headers, json=payload)
print(response.text)





print("SMARTHIVES")
import requests

# API endpoint
url = "https://api.smarthivesms.com/api/sms/send"

# Your API Key
api_key = "SMTPUBK_0868871b974b4693921a271b08441af4"

# SMS payload
payload = {
    "sender": "Finta",          # Your approved Sender ID
    "recipients": "2348108394272",  # Recipient phone number in international format
    "msg": "Your OTP is 203424 ",           # SMS content
    "type": 1,                      # 0 = Flash, 1 = Inbox
    "route": "TRX",                 # MKT = Promotional, TRX = Transactional
}

# Headers
headers = {
    "Content-Type": "application/json",
    "x-api-key": api_key
}

# Send the POST request
response = requests.post(url, json=payload, headers=headers)

# Print the response
print(response.status_code)
print(response.json())
