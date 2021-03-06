
angular.module('PaperUI.controllers.setup', 
[]).controller('SetupPageController', function($scope, $location, thingTypeRepository, bindingRepository) {
    $scope.navigateTo = function(path) {
        $location.path('inbox/' + path);
    }
    $scope.thingTypes = [];
    thingTypeRepository.getAll(function(thingTypes) {
        $.each(thingTypes, function(i, thingType) {
            $scope.thingTypes[thingType.UID] = thingType;
        });
    });
}).controller('InboxController', function($scope, $timeout, $mdDialog, $q, inboxService, discoveryResultRepository, 
        thingTypeRepository, thingSetupService, toastService) {
    $scope.setHeaderText('Shows a list of found things in your home.')
    
    $scope.showScanDialog = function(event) {
		$mdDialog.show({
			controller : 'ScanDialogController',
			templateUrl : 'partials/dialog.scan.html',
			targetEvent : event,
		});
    }
    
    $scope.refresh = function() {
    	discoveryResultRepository.getAll(true);
    };
}).controller('InboxEntryController', function($scope, $mdDialog, $q, inboxService, discoveryResultRepository, 
        thingTypeRepository, thingSetupService, toastService, thingRepository) {
    $scope.approve = function(thingUID, thingTypeUID, event) {
        $mdDialog.show({
            controller : 'ApproveInboxEntryDialogController',
            templateUrl : 'partials/dialog.approveinboxentry.html',
            targetEvent : event,
            locals: {discoveryResult: discoveryResultRepository.find(function(discoveryResult) {
                return discoveryResult.thingUID === thingUID;
            })}
        }).then(function(result) {
            inboxService.approve({'thingUID' : thingUID, 'enableChannels': !$scope.advancedMode }, result.label).$promise.then(function() {
                return thingSetupService.setGroups({'thingUID' : thingUID}, result.groupNames).$promise;
            }).then(function() {
                thingRepository.setDirty(true);

                toastService.showDefaultToast('Thing added.', 'Show Thing', 'configuration/things/view/' + thingUID);
                var thingType = thingTypeRepository.find(function(thingType) {
                    return thingTypeUID === thingType.UID;
                });
                
                if(thingType && thingType.bridge) {
                    $scope.navigateTo('setup/search/' + thingUID.split(':')[0]);
                } else {
                	discoveryResultRepository.getAll(true);
                }
            });
        });
    };
    $scope.ignore = function(thingUID) {
        inboxService.ignore({
            'thingUID' : thingUID
        }, function() {
            $scope.refresh();
        });
    };
    $scope.unignore = function(thingUID) {
        inboxService.unignore({
            'thingUID' : thingUID
        }, function() {
            $scope.refresh();
        });
    };
    $scope.remove = function(thingUID, event) {
        var discoveryResult = discoveryResultRepository.find(function(discoveryResult) {
            return discoveryResult.thingUID === thingUID;
        });
        var confirm = $mdDialog.confirm()
          .title('Remove ' + discoveryResult.label)
          .content('Would you like to remove the discovery result from the inbox?')
          .ariaLabel('Remove Discovery Result')
          .ok('Remove')
          .cancel('Cancel')
          .targetEvent(event);
        $mdDialog.show(confirm).then(function() {
            inboxService.remove({
                'thingUID' : thingUID
            }, function() {
                $scope.refresh();
                toastService.showSuccessToast('Inbox entry removed');
            });
        });
    };
}).controller('ScanDialogController', function($scope, $rootScope, $timeout, $mdDialog, discoveryService, bindingRepository) {
    $scope.supportedBindings = [];
    $scope.activeScans = [];
    
    $scope.scan = function(bindingId) {
        $scope.activeScans.push(bindingId);
    	discoveryService.scan({
            'bindingId' : bindingId
        }, function() {

        });
    	setTimeout(function() {
    	    $scope.$apply(function () {
    	        $scope.activeScans.splice($scope.activeScans.indexOf(bindingId), 1)
    	    });
        }, 3000);
    };
    
    bindingRepository.getAll();
    
    $scope.getBindingById = function(bindingId) {
    	for (var i = 0; i < $rootScope.data.bindings.length; i++) {
            var binding = $rootScope.data.bindings[i];
            if(binding.id === bindingId) {
            	return binding;
            }
    	}
    	return {};
    }
    
    discoveryService.getAll(function(response) {
        $scope.supportedBindings = response;
    });
    
    $scope.close = function() {
		$mdDialog.hide();
	}
}).controller('ApproveInboxEntryDialogController', function($scope, $mdDialog, discoveryResult, thingTypeRepository, 
        homeGroupRepository) {
	$scope.discoveryResult = discoveryResult;
	$scope.label = discoveryResult.label;
	$scope.homeGroups = [];
    $scope.groupNames = [];
    $scope.thingType = null;
    $scope.thingTypeUID = discoveryResult.thingTypeUID;
    thingTypeRepository.getOne(function(thingType) {
        return thingType.UID === $scope.thingTypeUID;
    }, function(thingType) {
        $scope.thingType = thingType;
    });

    homeGroupRepository.getAll(function(homeGroups) {
        $.each(homeGroups, function(i, homeGroup) {
            $scope.groupNames[homeGroup.name] = false;
        });
        $scope.homeGroups = homeGroups;
    });
    
	$scope.close = function() {
		$mdDialog.cancel();
	}
	$scope.approve = function(label) {
	    var selectedGroupNames = [];
	    for (var groupName in $scope.groupNames) {
            if($scope.groupNames[groupName]) {
                selectedGroupNames.push(groupName);
            }
        }
		$mdDialog.hide({label: label,  groupNames: selectedGroupNames});
	}
}).controller('ManualSetupChooseController', function($scope, bindingRepository, thingTypeRepository, thingSetupService) {
	$scope.setSubtitle(['Manual Setup']);
	$scope.setHeaderText('Choose a thing, which should be aded manually to your Smart Home.')
	
	$scope.currentBindingId = null;
	$scope.setCurrentBindingId = function(bindingId) {
		$scope.currentBindingId = bindingId;
	};
	
    bindingRepository.getAll(function(data) {
	});
   
}).controller('ManualSetupConfigureController', function($scope, $routeParams, $mdDialog, toastService, 
		bindingRepository, thingTypeRepository, thingSetupService, homeGroupRepository, thingRepository, configService) {
	
	var thingTypeUID = $routeParams.thingTypeUID;
	
	function generateUUID() {
	    var d = new Date().getTime();
	    var uuid = 'xxxxxxxx'.replace(/[x]/g, function(c) {
	        var r = (d + Math.random()*16)%16 | 0;
	        d = Math.floor(d/16);
	        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
	    });
	    return uuid;
	};
	
	$scope.thingType = null;
	$scope.thing = {
		UID: null,
		configuration : {},
		item: {
			label: null,
			groupNames: []
		}
	}
	$scope.homeGroups = [];
    $scope.groupNames = [];

    homeGroupRepository.getAll(function(homeGroups) {
        $.each(homeGroups, function(i, homeGroup) {
            $scope.groupNames[homeGroup.name] = false;
        });
        $scope.homeGroups = homeGroups;
    });

	$scope.addThing = function(thing) {
	    
	    for (var groupName in $scope.groupNames) {
            if($scope.groupNames[groupName]) {
                thing.item.groupNames.push(groupName);
            }
        }
		thingSetupService.add({'enableChannels': !$scope.advancedMode}, thing, function() {
		    homeGroupRepository.setDirty(true);
			toastService.showDefaultToast('Thing added');
			$scope.navigateTo('setup/search/' + $scope.thingType.UID.split(':')[0]);
		});
	};
	
	$scope.needsBridge = false;
	$scope.bridges = [];
	$scope.getBridges = function() {
	    $scope.bridges = [];
	    thingRepository.getAll(function(things) {
            for (var i = 0; i < things.length; i++) {
                var thing = things[i];
                for (var j = 0; j < $scope.thingType.supportedBridgeTypeUIDs.length; j++) {
                    var supportedBridgeTypeUID = $scope.thingType.supportedBridgeTypeUIDs[j];
                    if(thing.thingTypeUID === supportedBridgeTypeUID) {
                        $scope.bridges.push(thing);
                    }   
                }
            }
        });
    };
	
	thingTypeRepository.getOne(function(thingType) {
    	return thingType.UID === thingTypeUID;
    },function(thingType) {
    	$scope.setTitle('Configure ' + thingType.label);
    	$scope.setHeaderText(thingType.description);
		$scope.thingType = thingType;
        $scope.parameters = configService.getRenderingModel(thingType.configParameters, thingType.parameterGroups);
		$scope.thing.UID = thingType.UID + ':' + generateUUID();
		$scope.thing.item.label = thingType.label;
        $scope.thing.label = thingType.label;
		$scope.needsBridge = $scope.thingType.supportedBridgeTypeUIDs && $scope.thingType.supportedBridgeTypeUIDs.length > 0;
		if($scope.needsBridge) {
		    $scope.getBridges();
		}
		configService.setDefaults($scope.thing, $scope.thingType)
    });
}).controller('SetupWizardController', function($scope, discoveryResultRepository) {
    $scope.showIgnored = false;
    $scope.toggleShowIgnored = function() {
        $scope.showIgnored = !$scope.showIgnored;
    }
    $scope.refresh = function() {
        discoveryResultRepository.getAll(true);
    };
    $scope.refresh();
    $scope.filter = function(discoveryResult) {
        return $scope.showIgnored || discoveryResult.flag === 'NEW';
    }
}).controller('SetupWizardBindingsController', function($scope, bindingRepository) {
    $scope.setSubtitle(['Choose Binding']);
    $scope.setHeaderText('Choose a Binding for which you want to add new things.');
    bindingRepository.getAll();
    $scope.selectBinding = function(bindingId) {
        $scope.navigateTo('setup/search/' + bindingId);
    }
}).controller('SetupWizardSearchBindingController', function($scope, discoveryResultRepository, discoveryService, 
        thingTypeRepository, bindingRepository) {
    $scope.showIgnored = false;
    $scope.toggleShowIgnored = function() {
        $scope.showIgnored = !$scope.showIgnored;
    }
    $scope.bindingId = $scope.path[4];
    var binding = bindingRepository.find(function(binding) {
        return binding.id === $scope.bindingId;
    });
    $scope.setSubtitle([binding ? binding.name : '', 'Search']);
    $scope.setHeaderText('Searching for new things for the ' + (binding ? binding.name : '') + '.');
    
    $scope.discoverySupported = true;
    discoveryService.getAll(function(supportedBindings) {
        if(supportedBindings.indexOf($scope.bindingId) >= 0) {
            $scope.discoverySupported = true;
            $scope.scan($scope.bindingId);
        } else {
            $scope.discoverySupported = false;
        } 
    });
    
    $scope.scanning = false;
    $scope.filter = function(discoveryResult) {
        return ($scope.showIgnored || discoveryResult.flag === 'NEW') && discoveryResult.thingUID.split(':')[0] === $scope.bindingId;
    }
    $scope.scan = function(bindingId) {
        $scope.scanning = true;
        discoveryService.scan({
            'bindingId' : bindingId
        }, function() {
        });
        setTimeout(function() {
            $scope.$apply(function () {
                $scope.scanning = false; 
            });
        }, 10000);
    };
    
    $scope.refresh = function() {
        discoveryResultRepository.getAll(true);
    };
    $scope.refresh();
}).controller('SetupWizardThingTypesController', function($scope, bindingRepository) {
    $scope.bindingId = $scope.path[4];
    var binding = bindingRepository.find(function(binding) {
        return binding.id === $scope.bindingId;
    });
    $scope.setSubtitle([binding ? binding.name : '', 'Choose Thing']);
    $scope.setHeaderText('Choose a Thing from the ' + (binding ? binding.name : '') + ' which you want to add.');
    
    $scope.selectThingType = function(thingTypeUID) {
        $scope.navigateTo('setup/add/' + thingTypeUID);
    }
    $scope.filter = function(thingType) {
        return (thingType.UID.split(':')[0] === $scope.bindingId) && (thingType.listed);
    }
});