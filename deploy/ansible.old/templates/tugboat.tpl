---
authentication:
  client_key: {{ client_id }}
  api_key: {{ api_key }}
ssh:
  ssh_user: admin
  ssh_key_path: "{{ deploy_ssh_key }}"
  ssh_port: '22'
defaults:
  region: '{{ default_region }}'
  image: '{{ default_image }}'
  size: '{{ default_size }}'
  ssh_key: ''
  private_networking: 'true'
  backups_enabled: 'false'
