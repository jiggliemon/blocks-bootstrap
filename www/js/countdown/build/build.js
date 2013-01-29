({
   baseUrl: "../../"
  ,packages:[
     {name:'blocks',location:'blocks/src'}
    ,{name:'countdown', location: 'countdown/src'}
    ,{name:'yaul',location:'yaul/src'}
    ,{name:'yeah',location:'yeah/src',main:'index'}
    ,{name:'yate',location:'yate/src',main:'index'}
  ]
  ,include: ['blocks/block','yeah','yate','countdown']
  ,stubModules:['text']
  ,optimize: 'none'
  //,findNestedDependencies: true
  ,out: "../countdown.js"
  ,cjsTranslate: true
})
