'use strict';
angular.module('ngDropbox', ['ngResource'])
	.provider('$dropbox', function $dropboxProvider(){
		var clientId, OAuthToken, redirectUri;
		
		var settings = this.settings = {
			app_key: null,
			app_secret: null,
			oauth: {
				secret: null,
				token: null,
				uid: null
			},
			oauth2: null,
			redirectUri: null,
			request: {
				secret: null,
				token: null
			}
		};
		
		this.$get = ['$http','$log','$q','$resource','$window', function($http,$log,$q,$resource,$window){
			function dialogSize(popupWidth, popupHeight) {
				var x0, y0, width, height, popupLeft, popupTop;
				x0 = $window.screenX || $window.screenLeft
				y0 = $window.screenY || $window.screenTop
				width = $window.outerWidth || $document.documentElement.clientWidth
				height = $window.outerHeight || $document.documentElement.clientHeight
				popupLeft = Math.round(x0) + (width - popupWidth) / 2
				popupTop = Math.round(y0) + (height - popupHeight) / 2.5
				if (popupLeft < x0) popupLeft = x0;
				if (popupTop < y0) popupTop = y0;
				
				return 'width=' + popupWidth + ',height=' + popupHeight + ',left=' + popupLeft + ',top=' + popupTop + ',' + 'dialog=yes,dependent=yes,scrollbars=yes,location=yes';
			}
			function sanitizePath(path){
				// TODO: clean up the path
				return path;
			}
			function authorizationHeader(){
				if (settings.oauth2){
					var header = 'Bearer ' + settings.oauth2;
				} else {
					var header = 'OAuth oauth_version="1.0", oauth_signature_method="PLAINTEXT", oauth_consumer_key="'+settings.app_key+'", oauth_token="'+settings.oauth.token+', oauth_signature="'+settings.app_secret+'&'+settings.oauth.secret+'"'
				}
				return {'Authorization': header};
			}
			
			return {
				self: this,
				
				oauth1: function(){
					// Shorthand method for OAuth 1.0
					var deferred = $q.defer(), self = this;
					self.request_token().then(function(){
						self.authorize_v1().then(function(){
							self.access_token().then(function(oauth){
								deferred.resolve(oauth);
							}, function(error){
								deferred.reject(error);
							});
						}, function(error){
							deferred.reject(error);
						})
					}, function(error){
						deferred.reject(error);
					})
					return deferred.promise;
				},
				oauth2: function(){
					return this.authorize_v2()
				},
				
				/** OAuth 1 **/
				access_token: function(){
					var deferred = $q.defer();
					$http.post('https://api.dropbox.com/1/oauth/access_token', null, {
						headers: {
							'Authorization': 'OAuth oauth_version="1.0", oauth_signature_method="PLAINTEXT", oauth_consumer_key="'+settings.app_key+'", oauth_token="'+settings.request.token+'", oauth_signature="'+settings.app_secret+'&'+settings.request.secret+'"'
						}
					}).success(function(response){
						// Parse response
						try {
							settings.oauth.secret = response.match(/oauth_token_secret=([\w]+)/)[1];
							settings.oauth.token = response.match(/oauth_token=([\w]+)/)[1];
							deferred.resolve(settings.oauth);
						} catch(e){
							$log.error(e.message)
						}
					}).error(function(error){
						deferred.reject(error);
					})
					return deferred.promise;
				},
				
				authorize_v1: function(){
					// OAuth v1
					var deferred = $q.defer();
					var authUrl = 'https://www.dropbox.com/1/oauth/authorize?oauth_token='+ settings.request.token +'&oauth_callback=' + settings.redirectUri
					function listener(event){
						$window.removeEventListener('message', listener, false);
						try {
							if (event.data && event.data != '?not_approved=true'){
								settings.oauth.uid = event.data.match(/uid=([\d]+)/)[1];
								return deferred.resolve();
							}
							return deferred.reject();
						} catch(e){
							$log.error(e.message)
							return deferred.reject();
						}
					}
					$window.addEventListener('message', listener, false);
					$window.open(authUrl, '_dropboxOauthSigninWindow', dialogSize(700, 500));
					return deferred.promise;
				},
				
				request_token: function(){
					var deferred = $q.defer();
					$http.post('https://api.dropbox.com/1/oauth/request_token', null, {
						headers: {
							'Authorization': 'OAuth oauth_version="1.0", oauth_signature_method="PLAINTEXT", oauth_consumer_key="'+settings.app_key+'", oauth_signature="'+settings.app_secret+'&"'
						}
					}).success(function(response){
						try {
							settings.request.token	= response.match(/oauth_token=([\w]+)/i)[1];
							settings.request.secret	= response.match(/oauth_token_secret=([\w]+)/)[1];
							return deferred.resolve();
						} catch(e){
							$log.error(e.message)
							return deferred.reject();
						}
					}).error(function(response){
						deferred.reject(response.error);
					});
					return deferred.promise;
				},
				
				/*
				token_from_oauth1: function(){
					
					$http.post('https://api.dropbox.com/1/oauth2/token_form_oauth1', null, {
						headers: {
							'Authorization': 'OAuth oauth_version="1.0", oauth_signature_method="PLAINTEXT", oauth_consumer_key="'+settings.app_key+'", oauth_token="'+settings.request.token+'", oauth_signature="'+settings.app_secret+'&'+settings.request.secret+'"'
						}
					}).success(function(response){
						// Parse response
					}).error(function(error){
						
					})

					$http.post('https://api.dropbox.com/1/oauth2/token_from_oauth1').success(function(json){
				//		if (json.access_token) self.setToken(json.access_token);
						return json.access_token;
					});
				},
				*/
				
				
				/** OAuth 2 **/
				authorize_v2: function(){
					// OAuth2...
					var self = this, deferred = $q.defer();
					var authUrl = 'https://www.dropbox.com/1/oauth2/authorize?client_id='+ this.clientId +'&response_type=token&redirect_uri=' + this.redirectUri
					function listener(event) {
						if (event.data){
							var response = {}, data = event.data.replace(/^#/, '').split('&');
							angular.forEach(data, function(kvp){
								var kv = kvp.match(/^([a-z_]+)=(.*)/);
								response[kv[1]] = kv[2];
							});
							if (response.access_token){
								settings.oauth2 = response.access_token;
								deferred.resolve(response);
							} else {
								deferred.reject(response);
							}
						}
						$window.removeEventListener('message', listener, false);
					}
					$window.addEventListener('message', listener, false);
					$window.open(authUrl,'_dropboxOauthSigninWindow', dialogSize(700, 500));
					return deferred.promise;
				},
				
				account: function(){
					return $http.get('https://api.dropbox.com/1/account/info', {headers: authorizationHeader()});
				},
				datastore: {
					// TODO: datastore methods
					create: function(id){
						return $http.post('https://api.dropbox.com/1/datastores/get_or_create_datastore', null, {params:{dsid:id}});
					},
					delete: function(id){
						return $http.post('https://api.dropbox.com/1/datastores/delete_datastore', null, {params:{handle:id}});
					},
					get: function(datastore){
						return $http.get('https://api.dropbox.com/1/datastores/get_datastore', {params:{dsid:id}, headers: authorizationHeader()});
					},
					list: function(){
						return $http.get('https://api.dropbox.com/1/datastores/list_datastores', {headers: authorizationHeader()});
					}
				},
				fileops: {
					copy: function(from,to){
						return $http.post('https://api.dropbox.com/1/fileops/copy', null, {params:{root: 'auto', from_path: from, to_path: to}, headers: authorizationHeader()});
					},
					create_folder: function(path){
						return $http.post('https://api.dropbox.com/1/fileops/create_folder', null, {params:{root:'auto',path:path}, headers: authorizationHeader()});
					},
					delete: function(path){
						return $http.post('https://api.dropbox.com/1/fileops/delete', null, {params:{root:'auto',path:path}, headers: authorizationHeader()});
					},
					move: function(from,to){
						return $http.post('https://api.dropbox.com/1/fileops/move', null, {params:{root: 'auto', from_path: from, to_path: to}, headers: authorizationHeader()});
					}
				},
				files: function(path){
					var params = {};
					if (typeof(rev) != 'undefined') params.rev = rev;
					return $http.get('https://api-content.dropbox.com/1/files/auto/'+path, {params: params, headers: authorizationHeader()});
				},
				files_put: function(path, data){
					// Upload file to dropbox
					return $http.put('https://api-content.dropbox.com/1/files_put/auto/'+path, data, {headers: authorizationHeader()});
				},
				media: function(path){
					return $http.post('https://api.dropbox.com/1/media/auto/'+path, null, {headers: authorizationHeader()});
				},
				metadata: function(path){
					if (!path || path == '') path = '/';
					return $http.get('https://api.dropbox.com/1/metadata/auto/'+path, {params:{list: true, include_deleted:false}, headers: authorizationHeader()});
				},
				previews: function(path, rev){
					var params = {};
					if (typeof(rev) != 'undefined') params.rev = rev;
					return $http.get('ttps://api-content.dropbox.com/1/previews/auto/'+path, {params: params, headers: authorizationHeader()});
				},
				restore: function(path, rev){
					return $http.post('https://api.dropbox.com/1/restore/auto/'+path, {rev: rev}, {headers: authorizationHeader()});
				},
				revisions: function(path){
					return $http.get('https://api.dropbox.com/1/revisions/auto/'+path, {params:{rev_limit:50}, headers: authorizationHeader()});
				},
				search: function(path, query){
					return $http.post('https://api.dropbox.com/1/search/auto/'+path, {query: query, include_deleted: true}, {headers: authorizationHeader()});
				},
				
				/* Helper and alias methods */
				
				delete: function(path){
					return this.fileopts.delete(path);	
				},
				isAuthorized: function(){
					return (this.oauth.access_token) ? true : false;
				},
				list: function(path){
					return this.metadata(path);
				},
				upload: function(path, data){
					return this.files_put(path,data);
				}
			};
		}];
	})