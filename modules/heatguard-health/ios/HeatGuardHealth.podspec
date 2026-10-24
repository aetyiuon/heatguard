Pod::Spec.new do |s|
  s.name = 'HeatGuardHealth'
  s.version = '0.1.0'
  s.summary = 'Local opt-in HealthKit and paired Watch heart-rate bridge'
  s.description = 'Reads heart rate locally. No networking or health-data uploads.'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'HeatGuard contributors'
  s.homepage = 'https://github.com/aetyiuon/heatguard'
  s.platforms = { :ios => '16.0' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit', 'WatchConnectivity'
  s.swift_version = '5.9'
  s.source_files = '**/*.{h,m,mm,swift}'
end
