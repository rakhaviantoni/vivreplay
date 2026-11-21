# Instagram OAuth Troubleshooting Guide

## Problem: "No Facebook Pages found" Error

### Root Cause
The OAuth token is not returning any Facebook Pages when calling `/me/accounts`, even though the user has a Business account connected to a Facebook Page.

### Most Likely Issues

#### 1. **config_id Overrides scope Parameter** ⚠️ CRITICAL
When you include `config_id` in the OAuth URL, Meta **completely ignores** the `scope` parameter. The scopes MUST be configured in the Instagram Login Configuration in Meta Dashboard.

**Solution**: 
- Either remove `config_id` from the OAuth URL (recommended)
- OR configure all required scopes in the Configuration in Meta Dashboard

**Current fix**: Code now skips `config_id` by default unless you explicitly set a different value in `INSTAGRAM_CONFIG_ID` env variable.

#### 2. **Missing pages_show_list Permission**
Without `pages_show_list`, the API won't return any pages.

**Required Scopes**:
```
instagram_basic                  ✅ Required
instagram_content_publish        ✅ Required for posting
pages_show_list                  ✅ CRITICAL - without this, /me/accounts returns empty
pages_read_engagement            ✅ CRITICAL - needed to read page data
business_management              ✅ Recommended for Business features
```

#### 3. **User Role on Facebook Page**
The user must be an **Admin** or **Editor** of the Facebook Page. Moderator role is NOT sufficient.

**Check**: Go to Facebook Page → Settings → Page roles

#### 4. **Instagram Business Account Not Linked**
The Instagram account must be:
- Converted to Business or Creator account
- Linked to a Facebook Page

**Check**: Instagram app → Settings → Account → Switch to Professional Account → Connect to Facebook Page

---

## Debugging Steps

### Step 1: Test Your OAuth Token

Use the debug endpoint to inspect your token:

```bash
# After getting a token from OAuth, test it:
curl "https://vivreplay.com/api/market/social/debug-token?token=YOUR_ACCESS_TOKEN"
```

This will show:
- ✅ What permissions were actually granted
- ✅ How many Facebook Pages the token can access
- ✅ Which pages have Instagram Business accounts connected
- ✅ Direct Instagram accounts accessible
- ✅ Business accounts accessible

### Step 2: Check Permissions

Look at the `grantedPermissions` array in the debug output. You MUST see:
- `pages_show_list`
- `pages_read_engagement`
- `instagram_basic`
- `instagram_content_publish`

If these are missing, the scopes weren't properly requested or granted.

### Step 3: Check Meta Dashboard Configuration

1. Go to: https://developers.facebook.com/apps/{FACEBOOK_APP_ID}/instagram-login/settings/
2. Check **Login Configuration ID: 1455450343222088**
3. Verify these permissions are enabled:
   - Instagram Basic Display
   - Instagram Content Publishing
   - Pages Show List ⚠️
   - Pages Read Engagement ⚠️
   - Business Management

4. Check **Valid OAuth Redirect URIs** includes:
   ```
   https://vivreplay.com/api/market/social/callback
   ```

### Step 4: Try Manual OAuth with Graph API Explorer

1. Go to: https://developers.facebook.com/tools/explorer/
2. Select your app
3. Click "Get Token" → "Get User Access Token"
4. Select all required permissions
5. Generate token and test these queries:

```
# Should return your pages:
/me/accounts?fields=id,name,instagram_business_account

# Should return Instagram accounts:
/me/instagram_accounts

# Check token permissions:
/me/permissions
```

If these return empty in the Graph API Explorer, the issue is with your Meta app setup, not the VivrePlay code.

---

## Solutions

### Solution A: Remove config_id (Recommended) ✅

**Status**: ALREADY DONE in latest code

The code now defaults to NOT using `config_id`, which means the `scope` parameter will be respected.

Try OAuth again - it should now properly request all scopes.

### Solution B: Configure Instagram Login Configuration

If you want to keep using `config_id=1455450343222088`:

1. Go to Meta Dashboard: https://developers.facebook.com/apps/1035188289654735/instagram-login/settings/
2. Find Configuration ID: **1455450343222088**
3. Click **Edit**
4. Under **Permissions**, enable:
   - ✅ instagram_basic
   - ✅ instagram_content_publish
   - ✅ pages_show_list
   - ✅ pages_read_engagement
   - ✅ business_management
5. Save and try OAuth again

### Solution C: Use Facebook Login Instead

Instead of Instagram Login Configuration, use Facebook Login:

1. In Meta Dashboard, go to **Facebook Login** → **Settings**
2. Add redirect URI: `https://vivreplay.com/api/market/social/callback`
3. Set `INSTAGRAM_CONFIG_ID=""` in your environment (empty string)
4. Try OAuth again

---

## Environment Variables

```bash
# Current setup:
FACEBOOK_APP_ID=1035188289654735
FACEBOOK_APP_SECRET=your_app_secret
INSTAGRAM_APP_ID=1035188289654735  # Same as Facebook
INSTAGRAM_CONFIG_ID=1455450343222088  # REMOVE THIS or set to empty string
INSTAGRAM_REDIRECT_URI=https://vivreplay.com/api/market/social/callback
```

**Recommendation**: Remove or comment out `INSTAGRAM_CONFIG_ID` to let scopes work properly:

```bash
# INSTAGRAM_CONFIG_ID=1455450343222088  # Commented out
```

---

## Testing Checklist

After making changes, test in this order:

1. ✅ Clear browser cookies for facebook.com
2. ✅ Go to VivrePlay → Social Settings → Connect Instagram
3. ✅ Check OAuth URL in browser (should NOT have config_id)
4. ✅ Grant all permissions when prompted
5. ✅ Check browser console for debug logs
6. ✅ Check server logs for API responses
7. ✅ Use debug endpoint to verify token permissions

---

## Meta Dashboard Links

- **App Dashboard**: https://developers.facebook.com/apps/1035188289654735/
- **Instagram Login**: https://developers.facebook.com/apps/1035188289654735/instagram-login/settings/
- **Facebook Login**: https://developers.facebook.com/apps/1035188289654735/fb-login/settings/
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer/1035188289654735/
- **Access Token Debugger**: https://developers.facebook.com/tools/debug/accesstoken/

---

## Common Error Messages

### "No Facebook Pages found"
→ Missing `pages_show_list` permission OR config_id is blocking scopes

### "No Instagram Business Account is connected"
→ Instagram account not converted to Business OR not linked to Facebook Page

### "Invalid OAuth redirect URI"
→ Redirect URI not added to Meta app settings

### "This authorization code has been used"
→ Token already exchanged, try OAuth flow again (clear cookies)

---

## Still Not Working?

If none of these solutions work:

1. Check if app is in **Development Mode** vs **Live Mode**
   - Development mode only works for app admins/developers
   - Add your Facebook account as a test user

2. Check App Review status
   - Some permissions require App Review approval
   - `pages_show_list` and `pages_read_engagement` typically don't require review for Business use cases

3. Check Meta Business Settings
   - Verify your Facebook Page is added to the Business Manager
   - Verify the app has access to the Business

4. Contact Meta Support
   - File a bug report if API is returning empty data despite correct permissions
