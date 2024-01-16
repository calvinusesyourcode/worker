import async from 'async';

// Creating a tasks array
const tasks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 
// Defining the queue
const queue = async.queue(async (task, completed) => {
    console.log("Currently Busy Processing Task " + task);
     
    // Simulating a Complex task
    setTimeout(()=>{
        // The number of tasks to be processed
        const remaining = queue.length();
        completed(null, {task, remaining});
    }, 1000);
 
}, 1); // The concurrency value is 1
 
 
// The queue is idle as there are no elements
// for the queue to process
console.log(`Did the queue start ? ${queue.started}`)
 
// Adding the each task to the queue
tasks.forEach((task)=>{
 
    // Adding the 5th task to the head of the 
    // queue as it is deemed important by us
 if(task == 5){
    queue.unshift(task, (error)=>{
      if(error){
       console.log(`An error occurred while processing task`);
      }else {
       console.log(`Finished processing task`);
      }
    })      
        // Adding the task to the tail in the order of their appearance
 } else {
      queue.push(task, (error)=>{
       if(error){
        console.log(`An error occurred while processing task`);
       }else {
        console.log(`Finished processing task`);
      }
      })
    }
});
 
 
// Executes the callback when the queue is done processing all the tasks
queue.drain(() => {
    console.log('Successfully processed all items');
})
 
// The queue is not idle it is processing the tasks asynchronously
console.log(`Did the queue start ? ${queue.started}`)