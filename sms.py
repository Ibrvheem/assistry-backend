import requests
url = "https://v3.api.termii.com/api/sms/send"
payload = {
          "to": "2347019188467",
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


# import requests

# # API endpoint
# url = "https://api.smarthivesms.com/api/sms/send"

# # Your API Key
# api_key = "SMTPUBK_0868871b974b4693921a271b08441af4"

# # SMS payload
# payload = {
#     "sender": "Finta",          # Your approved Sender ID
#     "recipients": "2349066149772",  # Recipient phone number in international format
#     "msg": "Your OTP is 203424 ",           # SMS content
#     "type": 1,                      # 0 = Flash, 1 = Inbox
#     "route": "TRX",                 # MKT = Promotional, TRX = Transactional
# }

# # Headers
# headers = {
#     "Content-Type": "application/json",
#     "x-api-key": api_key
# }

# # Send the POST request
# response = requests.post(url, json=payload, headers=headers)

# # Print the response
# print(response.status_code)
# print(response.json())
