({
   baseUrl: "./"
  ,packages:[
     {name:'blocks',location:'blocks/src'}
    ,{name:'yaul',location:'yaul/src'}
    ,{name:'yeah',location:'yeah/src',main:'index'}
    ,{name:'yate',location:'yate/src',main:'index'}

  ]
  // ,modules: [
  //   {
  //      name:'blocks'
  //     ,include: ['blocks/block']
  //   }
  // ]
  ,name: 'blocks'
  // ,paths:{
  //   'blocks/block':'blocks/block/index'
  // }
  ,include: ['blocks/block']
  ,optimize: 'none'
  ,stubModule:['text']
  //,findNestedDependencies: true
  ,out: "blocks.js"
  ,cjsTranslate: true
})
