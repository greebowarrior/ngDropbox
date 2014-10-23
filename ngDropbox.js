'use strict';
angular.module('ngDropbox', ['ngResource'])
	.provider('$dropbox', function $dropboxProvider(){
		var clientId, redirectUri;
		this.config = function(id,uri){
			clientId	= id;
			redirectUri	= uri;
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
				// clean up the path
				return path;
			}
			return {
				clientId: clientId,
				oauth: {access_token: null},
				redirectUri: redirectUri,
				self: this,
				
				account: function(){
					return $http.get('https://api.dropbox.com/1/account/info');
				},
				authorize: function(){
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
								self.setToken(response.access_token);
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
				datastore: {
					// TODO: datastore methods
					create: function(id){
						return $http.post('https://api.dropbox.com/1/datastores/get_or_create_datastore', {}, {params:{dsid:id}});
					},
					delete: function(id){
						return $http.post('https://api.dropbox.com/1/datastores/delete_datastore', {}, {params:{handle:id}});
					},
					get: function(datastore){
						return $http.get('https://api.dropbox.com/1/datastores/get_datastore', {params:{dsid:id}});
					},
					list: function(){
						return $http.get('https://api.dropbox.com/1/datastores/list_datastores');
					}
				},
				disable_access_token: function(){
					return $http.post('https://api.dropbox.com/1/disable_access_token');
				},
				fileops: {
					copy: function(from,to){
						return $http.post('https://api.dropbox.com/1/fileops/copy', {}, {params:{root: 'auto', from_path: from, to_path: to}});
					},
					create_folder: function(path){
						return $http.post('https://api.dropbox.com/1/fileops/create_folder', {}, {params:{root:'auto',path:path}});
					},
					delete: function(path){
						return $http.post('https://api.dropbox.com/1/fileops/delete', {}, {params:{root:'auto',path:path}});
					},
					move: function(from,to){
						return $http.post('https://api.dropbox.com/1/fileops/move', {}, {params:{root: 'auto', from_path: from, to_path: to}});
					}
				},
				files: function(path){
					var params = {};
					if (typeof(rev) != 'undefined') params.rev = rev;
					return $http.get('ttps://api-content.dropbox.com/1/files/auto/'+path, {params: params});
				},
				files_put: function(path, data){
					// Upload file to dropbox
					return $http.put('https://api-content.dropbox.com/1/files_put/auto/'+path, data);
				},
				media: function(path){
					return $http.post('https://api.dropbox.com/1/media/auto/'+path);
				},
				metadata: function(path){
					return $http.get('https://api.dropbox.com/1/metadata/auto/'+path, {params:{list: true, include_deleted:true}});
				},
				previews: function(path, rev){
					var params = {};
					if (typeof(rev) != 'undefined') params.rev = rev;
					return $http.get('ttps://api-content.dropbox.com/1/previews/auto/'+path, {params: params});
				},
				restore: function(path, rev){
					return $http.post('https://api.dropbox.com/1/restore/auto/'+path, {rev: rev});
				},
				revisions: function(path){
					return $http.get('https://api.dropbox.com/1/revisions/auto/'+path, {params:{rev_limit:50}});
				},
				search: function(path, query){
					return $http.post('https://api.dropbox.com/1/search/auto/'+path, {query: query, include_deleted: true});
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
				setToken: function(token){
					this.oauth.access_token = token;
					$http.defaults.headers.common.Authorization = 'Bearer '+ token;
					return true;
				},
				upload: function(path, data){
					return this.files_put(path,data);
				}
			};
		}];
	})